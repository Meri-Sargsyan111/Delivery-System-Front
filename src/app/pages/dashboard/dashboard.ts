import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard {

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  totalOrders = 0;
  deliveredOrders = 0;
  cancelledOrders = 0;
  createdOrders = 0;

  constructor() {
    this.loadStatistics();
  }

  loadStatistics() {

    this.http.get<any>('http://localhost:8081/orders')
      .subscribe({
        next: (data) => {

          const orders = data.content;

          this.totalOrders = orders.length;

          this.deliveredOrders =
            orders.filter((o: any) => o.status === 'DELIVERED').length;

          this.cancelledOrders =
            orders.filter((o: any) => o.status === 'CANCELLED').length;

          this.createdOrders =
            orders.filter((o: any) => o.status === 'CREATED').length;

          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
        }
      });
  }
}
