import { Component, computed, inject, signal, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { CourierService, Courier, CourierStatus, ManualCourierStatus } from '../../services/courier.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslationService } from '../../i18n/translation.service';
import { courierStatusKey } from '../../i18n/status-labels';

type CourierFilter = 'ALL' | CourierStatus;

function photoUrlValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;

  if (!value) {
    return null;
  }

  if (!/^https?:\/\//i.test(value)) {
    return { photoUrlProtocol: true };
  }

  return null;
}

@Component({
  selector: 'app-couriers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './couriers.html',
  styleUrl: './couriers.css',
})
export class Couriers implements OnDestroy {
  private courierService = inject(CourierService);
  private cdr = inject(ChangeDetectorRef);
  private fb = inject(FormBuilder);
  private i18n = inject(TranslationService);

  readonly courierStatusKey = courierStatusKey;

  readonly filters: { value: CourierFilter; labelKey: string }[] = [
    { value: 'ALL', labelKey: 'couriers.filterAll' },
    { value: 'AVAILABLE', labelKey: 'couriers.filterAvailable' },
    { value: 'BUSY', labelKey: 'couriers.filterBusy' },
    { value: 'OFFLINE', labelKey: 'couriers.filterOffline' },
  ];

  couriers: Courier[] = [];
  activeFilter: CourierFilter = 'ALL';
  loading = false;

  /** Pagination metadata from the last `/courier` response, kept for a future paginated UI. */
  totalElements = 0;
  totalPages = 0;
  pageNumber = 0;
  pageSize = 0;
  private errorMessageState = this.createMessageState();
  errorMessage = this.errorMessageState.text;

  /**
   * `params` is a thunk (not a plain object) so a nested translated value - e.g. the
   * courier status word in `couriers.success.statusChanged` - is resolved fresh on every
   * read of `actionSuccess`, rather than being frozen in the language active when the
   * action happened.
   */
  private actionSuccessKey = signal<{ key: string; params?: () => Record<string, string | number> } | null>(null);
  actionSuccess = computed(() => {
    const state = this.actionSuccessKey();
    return state ? this.i18n.t(state.key, state.params?.()) : null;
  });
  private actionErrorState = this.createMessageState();
  actionError = this.actionErrorState.text;
  pendingCourierId: number | null = null;
  private successTimeout: ReturnType<typeof setTimeout> | null = null;

  showAddModal = false;
  addSubmitting = false;
  addSubmitted = false;
  private addErrorState = this.createMessageState();
  addError = this.addErrorState.text;

  addForm = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(100)]),
    photoUrl: this.fb.control('', [Validators.maxLength(500), photoUrlValidator]),
  });

  brokenAvatarIds = new Set<number>();

  get name() {
    return this.addForm.controls.name;
  }

  get photoUrl() {
    return this.addForm.controls.photoUrl;
  }

  constructor() {
    this.loadCouriers();
  }

  ngOnDestroy() {
    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
    }
  }

  setFilter(filter: CourierFilter) {
    if (this.activeFilter === filter) {
      return;
    }
    this.activeFilter = filter;
    this.loadCouriers();
  }

  loadCouriers() {
    this.loading = true;
    this.errorMessageState.clear();

    const status = this.activeFilter === 'ALL' ? undefined : this.activeFilter;

    this.courierService.getCouriers(status).subscribe({
      next: (page) => {
        this.couriers = page.content;
        this.totalElements = page.totalElements;
        this.totalPages = page.totalPages;
        this.pageNumber = page.number;
        this.pageSize = page.size;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.applyErrorMessage(this.errorMessageState, err, 'couriers.errors.loadCouriers');
        this.cdr.detectChanges();
      },
    });
  }

  openAddModal() {
    this.showAddModal = true;
    this.addSubmitted = false;
    this.addErrorState.clear();
    this.addForm.reset({ name: '', photoUrl: '' });
  }

  closeAddModal() {
    this.showAddModal = false;
    this.addSubmitting = false;
    this.addSubmitted = false;
    this.addErrorState.clear();
  }

  submitAddCourier() {
    this.addSubmitted = true;
    this.addErrorState.clear();

    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    if (this.addSubmitting) {
      return;
    }

    this.addSubmitting = true;
    const name = this.name.value!.trim();
    const photoUrl = this.photoUrl.value?.trim() || null;

    this.courierService.createCourier(name, photoUrl).subscribe({
      next: () => {
        this.addSubmitting = false;
        this.closeAddModal();
        this.showActionSuccess('couriers.success.added', () => ({ name }));
        this.loadCouriers();
      },
      error: (err) => {
        this.addSubmitting = false;
        this.applyErrorMessage(this.addErrorState, err, 'couriers.errors.addCourier');
        this.cdr.detectChanges();
      },
    });
  }

  setCourierStatus(courier: Courier, status: ManualCourierStatus) {
    if (this.pendingCourierId !== null) {
      return;
    }

    this.pendingCourierId = courier.id;
    this.actionErrorState.clear();

    this.courierService.changeStatus(courier.id, status).subscribe({
      next: () => {
        this.pendingCourierId = null;
        this.showActionSuccess('couriers.success.statusChanged', () => ({
          name: courier.name,
          status: this.i18n.t(courierStatusKey(status)),
        }));
        this.loadCouriers();
      },
      error: (err) => {
        this.pendingCourierId = null;
        this.applyErrorMessage(this.actionErrorState, err, 'couriers.errors.updateStatus');
        this.cdr.detectChanges();
      },
    });
  }

  showAvatarImage(courier: Courier): boolean {
    return !!courier.photoUrl && !this.brokenAvatarIds.has(courier.id);
  }

  onAvatarError(courierId: number) {
    this.brokenAvatarIds.add(courierId);
    this.cdr.detectChanges();
  }

  initialsFor(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return '?';
    }

    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }

    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  private showActionSuccess(key: string, params?: () => Record<string, string | number>) {
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

    this.cdr.detectChanges();
  }

  /**
   * A backend-supplied message is raw text and must never be translated. A frontend
   * fallback, however, must stay reactive to a later language switch - so it's kept as a
   * translation key and only resolved to text inside a computed (see `createMessageState`),
   * which re-runs whenever the active language changes (unlike a plain string captured once
   * at error time).
   */
  private createMessageState() {
    const serverMessage = signal<string | null>(null);
    const fallback = signal<string | null>(null);
    const text = computed(() => serverMessage() ?? (fallback() ? this.i18n.t(fallback()!) : null));

    return {
      text,
      setServer: (message: string) => {
        serverMessage.set(message);
        fallback.set(null);
      },
      setFallback: (key: string) => {
        serverMessage.set(null);
        fallback.set(key);
      },
      clear: () => {
        serverMessage.set(null);
        fallback.set(null);
      },
    };
  }

  private applyErrorMessage(state: ReturnType<typeof this.createMessageState>, err: any, fallbackKey: string): string {
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

    state.setFallback(fallbackKey);
    return this.i18n.t(fallbackKey);
  }
}