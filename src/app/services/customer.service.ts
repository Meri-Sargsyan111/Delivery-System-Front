import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// Routed through api-gateway at the root, not under /auth - see order-service/courier-service
// for the same convention (ORDERS_API_BASE, COURIER_API_BASE). auth-service's CustomerController
// is mapped at /customers, not /auth/customers, specifically so this matches.
const CUSTOMERS_API_BASE = `${environment.apiBase}/customers`;

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {

  private http = inject(HttpClient);

  /** auth-service's GET /customers returns a plain array, not a paginated PageResponse. */
  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(CUSTOMERS_API_BASE);
  }

}
