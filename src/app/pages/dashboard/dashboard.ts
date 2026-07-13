import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OrderService, Order } from '../../services/order.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { orderStatusKey } from '../../i18n/status-labels';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private orderService = inject(OrderService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  readonly orderStatusKey = orderStatusKey;

  totalOrders = 0;
  deliveredOrders = 0;
  cancelledOrders = 0;
  createdOrders = 0;
  inProgressOrders = 0;

  /** Most recent orders, derived from the same already-fetched list used for the counts
   *  above - no separate request, no invented data. Ordered by id (descending) since Order
   *  carries no timestamp field to sort by. */
  recentOrders: Order[] = [];

  /** Reflects the real outcome of the last statistics fetch - not a simulated/fake signal.
   *  `lastUpdated` is the client-side moment that request last succeeded. */
  connectionOk = true;
  lastUpdated: Date | null = null;

  constructor() {
    this.loadStatistics();
  }

  goToOrders(status?: 'CREATED' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED') {
    this.router.navigate(['/orders'], status ? { queryParams: { status } } : undefined);
  }

  loadStatistics() {
    this.orderService.getOrders().subscribe({
      next: (data) => {
        const orders = data.content;

        this.totalOrders = orders.length;

        this.deliveredOrders = orders.filter((o) => o.status === 'DELIVERED').length;

        this.cancelledOrders = orders.filter((o) => o.status === 'CANCELLED').length;

        this.createdOrders = orders.filter((o) => o.status === 'CREATED').length;

        this.inProgressOrders = orders.filter((o) =>
          o.status === 'IN_PROGRESS' || o.status === 'ASSIGNED'
        ).length;

        this.recentOrders = [...orders].sort((a, b) => b.id - a.id).slice(0, 5);

        this.connectionOk = true;
        this.lastUpdated = new Date();

        this.cdr.detectChanges();
      },

      error: () => {
        this.connectionOk = false;
        this.cdr.detectChanges();
      },
    });
  }
}
