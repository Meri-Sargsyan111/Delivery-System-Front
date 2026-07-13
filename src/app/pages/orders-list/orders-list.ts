import { Component, computed, inject, signal, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subscription, forkJoin } from 'rxjs';
import { OrderService, Order } from '../../services/order.service';
import { CourierService, Courier } from '../../services/courier.service';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslationService } from '../../i18n/translation.service';
import { orderStatusKey, courierStatusKey } from '../../i18n/status-labels';

@Component({
  selector: 'app-orders-list',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './orders-list.html',
  styleUrl: './orders-list.css',
})
export class OrdersList implements OnDestroy {
  private orderService = inject(OrderService);
  private courierService = inject(CourierService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private i18n = inject(TranslationService);

  readonly orderStatusKey = orderStatusKey;
  readonly courierStatusKey = courierStatusKey;

  /**
   * Mirrors backend @PreAuthorize rules exactly (see order-service's OrderController /
   * OrderServiceImpl and courier-service's CourierController):
   *  - assign: ADMIN only
   *  - cancel: ADMIN or the owning CUSTOMER
   *  - start/deliver: ADMIN or the assigned COURIER
   *  - rate: ADMIN or CUSTOMER
   * Since /orders is already filtered server-side to each role's own data, any row a
   * CUSTOMER/COURIER sees here is by definition theirs.
   */
  canAssignCourier = computed(() => this.authService.isAdmin());
  canCancelOrder = computed(() => this.authService.isAdmin() || this.authService.isCustomer());
  canManageDelivery = computed(() => this.authService.isAdmin() || this.authService.isCourier());
  canRateDelivery = computed(() => this.authService.isAdmin() || this.authService.isCustomer());

  /**
   * Chat is only for the two active participants (see chat-service's business rules) -
   * ADMIN gets no entry point here (read-only access exists at the API level only).
   * Per-order gating (courier assigned) happens in the template, not here.
   */
  canChat = computed(() => this.authService.isCustomer() || this.authService.isCourier());

  emptyOrdersMessage = computed(() =>
    this.authService.isCourier() ? this.i18n.t('orders.emptyCourier') : this.i18n.t('orders.emptyDefault')
  );

  orders: Order[] = [];
  allOrders: Order[] = [];
  activeStatus: string | null = null;

  courierNames = new Map<number, string>();

  pageSize = 10;
  currentPage = 1;

  loading = false;
  private errorMessageState = this.createMessageState();
  errorMessage = this.errorMessageState.text;

  pendingOrderId: number | null = null;
  private actionSuccessKey = signal<{ key: string; params?: Record<string, string | number> } | null>(null);
  actionSuccess = computed(() =>
    this.actionSuccessKey() ? this.i18n.t(this.actionSuccessKey()!.key, this.actionSuccessKey()!.params) : null,
  );
  private actionErrorState = this.createMessageState();
  actionError = this.actionErrorState.text;

  assignModalOrder: Order | null = null;
  availableCouriers: Courier[] = [];
  selectedCourierId: number | null = null;
  assignModalLoading = false;
  assignSubmitting = false;
  private assignModalErrorState = this.createMessageState();
  assignModalError = this.assignModalErrorState.text;

  readonly ratingValues = [1, 2, 3, 4, 5];
  ratedOrderIds = new Set<number>();
  rateModalOrder: Order | null = null;
  selectedRating: number | null = null;
  rateSubmitting = false;
  private rateModalErrorState = this.createMessageState();
  rateModalError = this.rateModalErrorState.text;

  private queryParamSub: Subscription;
  private successTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.queryParamSub = this.route.queryParamMap.subscribe(params => {
      this.activeStatus = params.get('status');
      this.currentPage = 1;
      this.loadOrders();
    });
  }

  ngOnDestroy() {
    this.queryParamSub.unsubscribe();
    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
    }
  }

  clearFilter() {
    this.router.navigate(['/orders']);
  }

  get pagedOrders(): Order[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.orders.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.orders.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.currentPage = page;
  }

  prevPage() {
    this.goToPage(this.currentPage - 1);
  }

  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  loadOrders() {
    this.loading = true;
    this.errorMessageState.clear();

    const ordersRequest = this.activeStatus
      ? this.orderService.searchOrders(this.activeStatus)
      : this.orderService.getOrders();

    forkJoin({
      ordersPage: ordersRequest,
      couriers: this.courierService.getCouriers(),
    }).subscribe({
      next: ({ ordersPage, couriers }) => {
        this.orders = [...ordersPage.content];
        this.allOrders = [...ordersPage.content];
        this.courierNames = new Map(couriers.content.map((c) => [c.id, c.name]));

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.applyErrorMessage(this.errorMessageState, err, 'orders.errors.loadOrders');
        this.cdr.detectChanges();
      },
    });
  }

  courierNameFor(order: Order): string | null {
    if (order.courierId == null) {
      return null;
    }
    return this.courierNames.get(order.courierId) ?? this.i18n.t('orders.courierNumber', { id: order.courierId });
  }

  searchOrders(value: string) {
    if (!value) {
      this.orders = [...this.allOrders];
      this.currentPage = 1;
      return;
    }

    this.orders = this.allOrders.filter((order) =>
      order.customerName?.toLowerCase().includes(value.toLowerCase()),
    );

    this.currentPage = 1;
  }

  openAssignModal(order: Order) {
    this.assignModalOrder = order;
    this.selectedCourierId = null;
    this.assignModalErrorState.clear();
    this.availableCouriers = [];
    this.assignModalLoading = true;

    this.courierService.getAvailableCouriers().subscribe({
      next: (couriers) => {
        this.availableCouriers = couriers;
        this.assignModalLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.assignModalLoading = false;
        this.applyErrorMessage(this.assignModalErrorState, err, 'orders.errors.loadCouriers');
        this.cdr.detectChanges();
      },
    });
  }

  closeAssignModal() {
    this.assignModalOrder = null;
    this.availableCouriers = [];
    this.selectedCourierId = null;
    this.assignModalErrorState.clear();
    this.assignSubmitting = false;
  }

  selectCourier(courierId: number) {
    this.selectedCourierId = courierId;
  }

  confirmAssignment() {
    if (!this.assignModalOrder || this.selectedCourierId == null) {
      return;
    }

    const orderId = this.assignModalOrder.id;
    const courierId = this.selectedCourierId;

    this.assignSubmitting = true;
    this.assignModalErrorState.clear();

    this.orderService.assignCourier(orderId, courierId).subscribe({
      next: () => {
        this.patchOrder(orderId, { status: 'ASSIGNED', courierId });
        this.assignSubmitting = false;
        this.closeAssignModal();
        this.showActionSuccess('orders.success.assigned', { id: orderId });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.assignSubmitting = false;
        this.applyErrorMessage(this.assignModalErrorState, err, 'orders.errors.assignCourier');
        this.cdr.detectChanges();
      },
    });
  }

  openRateModal(order: Order) {
    this.rateModalOrder = order;
    this.selectedRating = null;
    this.rateModalErrorState.clear();
    this.rateSubmitting = false;
  }

  closeRateModal() {
    this.rateModalOrder = null;
    this.selectedRating = null;
    this.rateModalErrorState.clear();
    this.rateSubmitting = false;
  }

  selectRatingValue(value: number) {
    this.selectedRating = value;
  }

  submitRating() {
    if (!this.rateModalOrder || this.selectedRating == null || this.rateSubmitting) {
      return;
    }

    const orderId = this.rateModalOrder.id;
    const value = this.selectedRating;

    this.rateSubmitting = true;
    this.rateModalErrorState.clear();

    this.courierService.rateOrder(orderId, value).subscribe({
      next: () => {
        this.rateSubmitting = false;
        this.ratedOrderIds.add(orderId);
        this.closeRateModal();
        const successKey = value === 1 ? 'orders.success.rated' : 'orders.success.ratedPlural';
        this.showActionSuccess(successKey, { id: orderId, value });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.rateSubmitting = false;
        const message = this.applyErrorMessage(this.rateModalErrorState, err, 'orders.errors.submitRating');

        if (err?.status === 409 && /already.*rated/i.test(message)) {
          this.ratedOrderIds.add(orderId);
        }

        this.cdr.detectChanges();
      },
    });
  }

  startDelivery(order: Order) {
    this.runAction(
      order.id,
      this.courierService.startDelivery(order.id),
      () => {
        this.patchOrder(order.id, { status: 'IN_PROGRESS' });
        this.showActionSuccess('orders.success.started', { id: order.id });
      },
      'orders.errors.startDelivery',
    );
  }

  deliverOrder(order: Order) {
    this.runAction(
      order.id,
      this.courierService.deliverOrder(order.id),
      () => {
        this.patchOrder(order.id, { status: 'DELIVERED' });
        this.showActionSuccess('orders.success.delivered', { id: order.id });
      },
      'orders.errors.deliverOrder',
    );
  }

  cancelOrder(order: Order) {
    this.runAction(
      order.id,
      this.orderService.cancelOrder(order.id),
      () => {
        this.patchOrder(order.id, { status: 'CANCELLED' });
        this.showActionSuccess('orders.success.cancelled', { id: order.id });
      },
      'orders.errors.cancelOrder',
    );
  }

  private runAction(orderId: number, request: Observable<unknown>, onSuccess: () => void, fallbackErrorKey: string) {
    this.pendingOrderId = orderId;
    this.actionErrorState.clear();

    request.subscribe({
      next: () => {
        this.pendingOrderId = null;
        onSuccess();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.pendingOrderId = null;
        this.applyErrorMessage(this.actionErrorState, err, fallbackErrorKey);
        this.cdr.detectChanges();
      },
    });
  }

  private patchOrder(orderId: number, changes: Partial<Order>) {
    const apply = (list: Order[]) => {
      const index = list.findIndex((o) => o.id === orderId);
      if (index !== -1) {
        list[index] = { ...list[index], ...changes };
      }
    };

    apply(this.orders);
    apply(this.allOrders);
  }

  private showActionSuccess(key: string, params?: Record<string, string | number>) {
    this.actionSuccessKey.set({ key, params });
    this.actionErrorState.clear();

    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
    }

    this.successTimeout = setTimeout(() => {
      this.actionSuccessKey.set(null);
      this.successTimeout = null;
      this.cdr.detectChanges();
    }, 4000);
  }

  /**
   * A backend-supplied message is raw text and must never be translated. A frontend
   * fallback, however, must stay reactive to a later language switch - so it's kept as a
   * translation key+params and only resolved to text inside a computed (see
   * `createMessageState`), which re-runs whenever the active language changes (unlike a
   * plain string captured once at error time).
   */
  private createMessageState() {
    const serverMessage = signal<string | null>(null);
    const fallback = signal<{ key: string; params?: Record<string, string | number> } | null>(null);
    const text = computed(() =>
      serverMessage() ?? (fallback() ? this.i18n.t(fallback()!.key, fallback()!.params) : null),
    );

    return {
      text,
      setServer: (message: string) => {
        serverMessage.set(message);
        fallback.set(null);
      },
      setFallback: (key: string, params?: Record<string, string | number>) => {
        serverMessage.set(null);
        fallback.set({ key, params });
      },
      clear: () => {
        serverMessage.set(null);
        fallback.set(null);
      },
    };
  }

  /** Mirrors backend @PreAuthorize error shapes; returns the resolved text immediately for callers (e.g. the 409 "already rated" check) that need it synchronously. */
  private applyErrorMessage(
    state: ReturnType<typeof this.createMessageState>,
    err: any,
    fallbackKey: string,
    fallbackParams?: Record<string, string | number>,
  ): string {
    if (err?.status === 0) {
      state.setFallback('errors.network');
      return this.i18n.t('errors.network');
    }

    if (err?.status === 403) {
      if (err.error?.message) {
        state.setServer(err.error.message);
        return err.error.message;
      }
      state.setFallback('errors.forbidden');
      return this.i18n.t('errors.forbidden');
    }

    let errorBody = err?.error;

    if (typeof errorBody === 'string') {
      try {
        errorBody = JSON.parse(errorBody);
      } catch {
      }
    }

    if (errorBody?.message) {
      state.setServer(errorBody.message);
      return errorBody.message;
    }

    state.setFallback(fallbackKey, fallbackParams);
    return this.i18n.t(fallbackKey, fallbackParams);
  }
}
