import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { roleGuard } from './role-guard';
import { AuthService } from '../services/auth.service';

const TOKEN_STORAGE_KEY = 'auth_token';

function fakeToken(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${encode({ alg: 'RS256' })}.${encode(payload)}.fake-signature`;
}

describe('roleGuard', () => {
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });

    router = TestBed.inject(Router);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('allows access when the user has one of the allowed roles', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, fakeToken({ sub: 'u1', role: 'ROLE_ADMIN' }));

    const result = TestBed.runInInjectionContext(() => roleGuard(['ROLE_ADMIN'])({} as any, {} as any));

    expect(result).toBe(true);
  });

  it('redirects to the dashboard when the role is not allowed', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, fakeToken({ sub: 'u2', role: 'ROLE_COURIER' }));

    const result = TestBed.runInInjectionContext(() => roleGuard(['ROLE_ADMIN'])({} as any, {} as any));

    expect(result).toEqual(router.parseUrl('/'));
  });

  it('redirects to the dashboard when there is no role at all', () => {
    const result = TestBed.runInInjectionContext(() => roleGuard(['ROLE_ADMIN'])({} as any, {} as any));

    expect(result).toEqual(router.parseUrl('/'));
  });

  it('allows access when any of multiple allowed roles matches', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, fakeToken({ sub: 'u3', role: 'ROLE_CUSTOMER' }));

    const result = TestBed.runInInjectionContext(() =>
      roleGuard(['ROLE_ADMIN', 'ROLE_CUSTOMER'])({} as any, {} as any)
    );

    expect(result).toBe(true);
  });
});
