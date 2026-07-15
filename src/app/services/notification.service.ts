import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PageResponse } from './order.service';
import { environment } from '../../environments/environment';

const NOTIFICATIONS_API_BASE = `${environment.apiBase}/notifications`;

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private http = inject(HttpClient);

  /** Defaults to a page size large enough to cover every notification rather than the
   *  backend's default of 20 - the component never overrides this, so a small default
   *  here would silently truncate the list, same as the order-service fix. */
  getNotifications(page = 0, size = 1000): Observable<PageResponse<string>> {
    return this.http.get<PageResponse<string>>(
      `${NOTIFICATIONS_API_BASE}?page=${page}&size=${size}&sort=id,desc`
    );
  }

}