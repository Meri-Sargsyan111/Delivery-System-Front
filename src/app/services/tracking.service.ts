import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const TRACKING_API_BASE = `${environment.apiBase}/tracking`;

@Injectable({ providedIn: 'root' })
export class TrackingService {

  private http = inject(HttpClient);

  /** Response shape varies by backend version: sometimes a paginated wrapper (`.content`),
   *  sometimes a bare array - callers must handle both, as tracking.ts already did. When it
   *  is paginated, request a page large enough to cover every event rather than the
   *  backend's default page size, same as the order-service fix. */
  getTrackingEvents(orderId: number): Observable<any> {
    return this.http.get<any>(`${TRACKING_API_BASE}/${orderId}`, { params: { size: '1000' } });
  }

}