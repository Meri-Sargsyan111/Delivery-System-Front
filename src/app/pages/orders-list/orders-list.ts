import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-orders-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orders-list.html',
  styleUrls: ['./orders-list.css']
})
export class OrdersList {

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  orders: any[] = [];
  allOrders: any[] = [];

  constructor() {
    this.loadOrders();
  }

  loadOrders() {
    this.http.get<any[]>('http://localhost:8081/orders')
      .subscribe({
        next: (data) => {

          this.orders = [...data];
          this.allOrders = [...data];

          this.cdr.detectChanges();

          console.log('ORDERS:', this.orders);
        },
        error: (err) => {
          console.error('ERROR:', err);
        }
      });
  }

  searchOrders(value: string) {

    if (!value) {
      this.orders = [...this.allOrders];
      return;
    }

    this.orders = this.allOrders.filter(order =>
      order.customerName?.toLowerCase().includes(value.toLowerCase())
    );
  }

  deliverOrder(orderId: number) {

    this.http.put(
      `http://localhost:8082/courier/deliver/${orderId}`,
      {},
      { responseType: 'text' }
    )
      .subscribe({
        next: (response) => {

          alert(response);

          this.loadOrders();
        },
        error: (err) => {

          console.error(err);

          alert('DELIVER ERROR');
        }
      });
  }

  cancelOrder(orderId: number) {

    this.http.put(
      `http://localhost:8081/orders/${orderId}/cancel`,
      {},
      { responseType: 'text' }
    )
      .subscribe({
        next: (response) => {

          alert(response);

          this.loadOrders();
        },
        error: (err) => {

          console.error(err);

          alert('CANCEL ERROR');
        }
      });
  }
}
