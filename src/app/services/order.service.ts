import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const ORDERS_API_BASE = `${environment.apiBase}/orders`;

export type OrderStatus = 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED';

export interface Order {
  id: number;
  customerName: string;
  customerPhone: string | null;
  fromAddress: string;
  toAddress: string;
  status: OrderStatus;
  courierId: number | null;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface CreateOrderRequest {
  customerName: string;
  customerPhone: string;
  fromAddress: string;
  toAddress: string;
}

export interface OrderActionResponse {
  id: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {

  private http = inject(HttpClient);

  createOrder(payload: CreateOrderRequest): Observable<any> {
    return this.http.post(ORDERS_API_BASE, payload);
  }

  /** Callers (dashboard, orders list) fetch once and paginate/filter client-side, so this
   *  requests a page large enough to cover every order rather than the backend's default
   *  page size of 20 - otherwise stats and the list silently drop anything past page 1. */
  getOrders(): Observable<PageResponse<Order>> {
    return this.http.get<PageResponse<Order>>(ORDERS_API_BASE, { params: { size: '1000' } });
  }

  getOrder(orderId: number): Observable<Order> {
    return this.http.get<Order>(`${ORDERS_API_BASE}/${orderId}`);
  }

  searchOrders(status: string): Observable<PageResponse<Order>> {
    return this.http.get<PageResponse<Order>>(`${ORDERS_API_BASE}/search`, { params: { status, size: '1000' } });
  }

  assignCourier(orderId: number, courierId: number): Observable<OrderActionResponse> {
    return this.http.put<OrderActionResponse>(
      `${ORDERS_API_BASE}/${orderId}/assign`,
      {},
      { params: { courierId: String(courierId) } }
    );
  }

  cancelOrder(orderId: number): Observable<OrderActionResponse> {
    return this.http.put<OrderActionResponse>(`${ORDERS_API_BASE}/${orderId}/cancel`, {});
  }

}