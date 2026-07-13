import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { authInterceptor } from './auth-interceptor';
import { AUTH_API_BASE, AuthService } from '../services/auth.service';

const TOKEN_STORAGE_KEY = 'auth_token';


/** Matches auth.service.spec.ts's helper - builds a fake (unsigned) JWT payload. */
function fakeToken(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.fake-signature`;
}

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let router: Router;
  let authService: AuthService;

  beforeEach(() => {
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  it('attaches a Bearer token to outgoing requests when one is present', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'existing-token');
    authService = TestBed.inject(AuthService);

    httpClient.get('/api/orders').subscribe();

    const req = httpMock.expectOne('/api/orders');
    expect(req.request.headers.get('Authorization')).toBe('Bearer existing-token');
    req.flush({});
  });

  it('does not attach an Authorization header when no token is present', () => {
    authService = TestBed.inject(AuthService);

    httpClient.get('/api/orders').subscribe();

    const req = httpMock.expectOne('/api/orders');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('on a 401 it refreshes exactly once and retries the original request', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'expired-token');
    authService = TestBed.inject(AuthService);

    let result: unknown;
    httpClient.get('/api/orders').subscribe(r => (result = r));

    const firstReq = httpMock.expectOne('/api/orders');
    expect(firstReq.request.headers.get('Authorization')).toBe('Bearer expired-token');
    firstReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne(`${AUTH_API_BASE}/refresh`);
    expect(refreshReq.request.withCredentials).toBe(true);
    refreshReq.flush({ accessToken: 'new-token' });

    const retriedReq = httpMock.expectOne('/api/orders');
    expect(retriedReq.request.headers.get('Authorization')).toBe('Bearer new-token');
    retriedReq.flush({ ok: true });

    expect(result).toEqual({ ok: true });
  });

  it('coalesces multiple simultaneous 401s into a single refresh call', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'expired-token');
    authService = TestBed.inject(AuthService);

    httpClient.get('/api/orders').subscribe();
    httpClient.get('/api/couriers').subscribe();

    const ordersReq = httpMock.expectOne('/api/orders');
    const couriersReq = httpMock.expectOne('/api/couriers');
    ordersReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    couriersReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne(`${AUTH_API_BASE}/refresh`);
    refreshReq.flush({ accessToken: 'new-token' });

    const retriedOrders = httpMock.expectOne('/api/orders');
    const retriedCouriers = httpMock.expectOne('/api/couriers');
    expect(retriedOrders.request.headers.get('Authorization')).toBe('Bearer new-token');
    expect(retriedCouriers.request.headers.get('Authorization')).toBe('Bearer new-token');
    retriedOrders.flush({});
    retriedCouriers.flush({});

    httpMock.expectNone(`${AUTH_API_BASE}/refresh`);
  });

  it('on refresh failure clears auth state, navigates to login, and propagates the error', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'expired-token');
    authService = TestBed.inject(AuthService);

    let capturedError: unknown;
    httpClient.get('/api/orders').subscribe({ error: e => (capturedError = e) });

    const req = httpMock.expectOne('/api/orders');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne(`${AUTH_API_BASE}/refresh`);
    refreshReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(authService.getToken()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(capturedError).toBeTruthy();
    httpMock.expectNone('/api/orders');
  });

  it('rejects a refreshed token belonging to a different user, clears this session, and redirects to login', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, fakeToken({ sub: 'courier-1', role: 'ROLE_COURIER' }));
    authService = TestBed.inject(AuthService);

    let capturedError: unknown;
    httpClient.get('/api/orders').subscribe({ error: e => (capturedError = e) });

    const req = httpMock.expectOne('/api/orders');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne(`${AUTH_API_BASE}/refresh`);
    refreshReq.flush({ accessToken: fakeToken({ sub: 'admin-1', role: 'ROLE_ADMIN' }) });

    expect(authService.getToken()).toBeNull();
    expect(authService.role()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(capturedError).toBeTruthy();
    httpMock.expectNone('/api/orders');
  });

  it('does not loop: a 401 on the retried request is not retried again', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'expired-token');
    authService = TestBed.inject(AuthService);

    let capturedError: unknown;
    httpClient.get('/api/orders').subscribe({ error: e => (capturedError = e) });

    const firstReq = httpMock.expectOne('/api/orders');
    firstReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne(`${AUTH_API_BASE}/refresh`);
    refreshReq.flush({ accessToken: 'new-token' });

    const retriedReq = httpMock.expectOne('/api/orders');
    retriedReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(capturedError).toBeTruthy();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    httpMock.expectNone(`${AUTH_API_BASE}/refresh`);
    httpMock.expectNone('/api/orders');
  });

  it('does not attempt to refresh a failed login call', () => {
    authService = TestBed.inject(AuthService);

    let capturedError: unknown;
    authService.login({ email: 'john@example.com', password: 'bad' }).subscribe({ error: e => (capturedError = e) });

    const loginReq = httpMock.expectOne(`${AUTH_API_BASE}/login`);
    loginReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone(`${AUTH_API_BASE}/refresh`);
    expect(capturedError).toBeTruthy();
  });

  it('does not attempt to refresh a failed register call', () => {
    authService = TestBed.inject(AuthService);

    let capturedError: unknown;
    authService.register({
      firstName: 'John', lastName: 'Doe', email: 'john@example.com',
      phoneNumber: '+1111111111', password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass',
      role: 'CUSTOMER'
    }).subscribe({ error: e => (capturedError = e) });

    const registerReq = httpMock.expectOne(`${AUTH_API_BASE}/register`);
    registerReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone(`${AUTH_API_BASE}/refresh`);
    expect(capturedError).toBeTruthy();
  });

  it('does not attempt to refresh a failed refresh call itself', () => {
    authService = TestBed.inject(AuthService);

    let capturedError: unknown;
    authService.refresh().subscribe({ error: e => (capturedError = e) });

    const refreshReq = httpMock.expectOne(`${AUTH_API_BASE}/refresh`);
    refreshReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone(`${AUTH_API_BASE}/refresh`);
    expect(capturedError).toBeTruthy();
  });
});
