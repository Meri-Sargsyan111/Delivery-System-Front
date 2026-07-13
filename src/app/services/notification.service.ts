import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PageResponse } from './order.service';
import { environment } from '../../environments/environment';

const NOTIFICATIONS_API_BASE = `${environment.apiBase}/notifications`;

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private http = inject(HttpClient);

  getNotifications(page = 0, size = 10): Observable<PageResponse<string>> {
    return this.http.get<PageResponse<string>>(
      `${NOTIFICATIONS_API_BASE}?page=${page}&size=${size}&sort=id,desc`
    );
  }

}