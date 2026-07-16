import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AUTH_API_BASE } from './auth.service';

const CUSTOMERS_API_BASE = `${AUTH_API_BASE}/customers`;

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {

  private http = inject(HttpClient);

  /** auth-service's GET /auth/customers returns a plain array, not a paginated PageResponse. */
  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(CUSTOMERS_API_BASE);
  }

}
