import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { AuthService, roleLabel } from './auth.service';

const TOKEN_STORAGE_KEY = 'auth_token';

/** Builds a fake (unsigned) JWT with the given payload, matching the shape auth-service issues. */
function fakeToken(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${encode({ alg: 'RS256' })}.${encode(payload)}.fake-signature`;
}

describe('AuthService', () => {
  beforeEach(() => {
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('decodes role and email from the stored access token', () => {
    sessionStorage.setItem(
      TOKEN_STORAGE_KEY,
      fakeToken({ sub: 'user-123', email: 'courier@example.com', role: 'ROLE_COURIER' })
    );

    const authService = TestBed.inject(AuthService);

    expect(authService.role()).toBe('ROLE_COURIER');
    expect(authService.currentUser()?.email).toBe('courier@example.com');
    expect(authService.isCourier()).toBe(true);
    expect(authService.isAdmin()).toBe(false);
    expect(authService.isCustomer()).toBe(false);
  });

  it('exposes isAdmin/isCustomer for the other roles', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, fakeToken({ sub: 'u1', email: 'admin@example.com', role: 'ROLE_ADMIN' }));
    let authService = TestBed.inject(AuthService);
    expect(authService.isAdmin()).toBe(true);

    sessionStorage.clear();
    sessionStorage.setItem(TOKEN_STORAGE_KEY, fakeToken({ sub: 'u2', email: 'cust@example.com', role: 'ROLE_CUSTOMER' }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    authService = TestBed.inject(AuthService);
    expect(authService.isCustomer()).toBe(true);
  });

  it('returns a null role and currentUser when no token is present', () => {
    const authService = TestBed.inject(AuthService);

    expect(authService.getToken()).toBeNull();
    expect(authService.role()).toBeNull();
    expect(authService.currentUser()).toBeNull();
    expect(authService.isAuthenticated()).toBe(false);
  });

  it('does not throw and returns a null role for a malformed token', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'not-a-valid-jwt');

    const authService = TestBed.inject(AuthService);

    expect(authService.currentUser()).toBeNull();
    expect(authService.role()).toBeNull();
  });

  it('maps roles to clean display labels', () => {
    expect(roleLabel('ROLE_ADMIN')).toBe('Admin');
    expect(roleLabel('ROLE_CUSTOMER')).toBe('Customer');
    expect(roleLabel('ROLE_COURIER')).toBe('Courier');
    expect(roleLabel(null)).toBe('User');
    expect(roleLabel(undefined)).toBe('User');
  });
});
