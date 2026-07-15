import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PageResponse } from './order.service';
import { environment } from '../../environments/environment';

const COURIER_API_BASE = `${environment.apiBase}/courier`;

export type CourierStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export type ManualCourierStatus = 'AVAILABLE' | 'OFFLINE';

export interface Courier {
  id: number;
  name: string;
  status: CourierStatus;
  averageRating: number | null;
  ratingCount: number;
  photoUrl?: string | null;
}

export interface RatingResponse {
  id: number;
  orderId: number;
  courierId: number;
  value: number;
  ratedAt: string;
}

@Injectable({ providedIn: 'root' })
export class CourierService {

  private http = inject(HttpClient);

  /** Requests a page large enough to cover every courier rather than the backend's default
   *  page size of 20 - otherwise the couriers list and the orders-list courier lookup
   *  silently drop anything past page 1, same as the order-service fix. */
  getCouriers(status?: CourierStatus): Observable<PageResponse<Courier>> {
    const params: Record<string, string> = { size: '1000' };
    if (status) {
      params['status'] = status;
    }
    return this.http.get<PageResponse<Courier>>(COURIER_API_BASE, { params });
  }

  getAvailableCouriers(): Observable<Courier[]> {
    return this.http.get<Courier[]>(`${COURIER_API_BASE}/available`);
  }

  startDelivery(orderId: number): Observable<string> {
    return this.http.put(`${COURIER_API_BASE}/start/${orderId}`, {}, { responseType: 'text' });
  }

  deliverOrder(orderId: number): Observable<string> {
    return this.http.put(`${COURIER_API_BASE}/deliver/${orderId}`, {}, { responseType: 'text' });
  }

  createCourier(name: string, photoUrl?: string | null): Observable<Courier> {
    return this.http.post<Courier>(COURIER_API_BASE, photoUrl ? { name, photoUrl } : { name });
  }

  changeStatus(courierId: number, status: ManualCourierStatus): Observable<Courier> {
    return this.http.put<Courier>(`${COURIER_API_BASE}/${courierId}/status`, {}, { params: { status } });
  }

  rateOrder(orderId: number, value: number): Observable<RatingResponse> {
    return this.http.post<RatingResponse>(`${COURIER_API_BASE}/rating/${orderId}`, { value });
  }

}
