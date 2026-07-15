import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Router } from '@angular/router';

import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
import { decodeJwtPayload } from '../utils/jwt.util';
import { environment } from '../../environments/environment';

export const AUTH_API_BASE = environment.authBase;
const AUTH_ORIGIN = AUTH_API_BASE.replace(/\/auth$/, '');
const TOKEN_STORAGE_KEY = 'auth_token';

export type AppRole = 'ROLE_ADMIN' | 'ROLE_CUSTOMER' | 'ROLE_COURIER';

/** Shape of the access token's payload, as issued by auth-service's JwtService. */
export interface DecodedAccessToken {
  sub: string;
  email?: string;
  role?: AppRole;
  exp?: number;
  iat?: number;
}

/**
 * auth-service returns avatarUrl as a path relative to its own origin (e.g.
 * "/auth/avatars/xxx.jpg"), not a full URL - AUTH_API_BASE always ends in "/auth"
 * (see environment.authBase), so the displayable image URL is that origin with the
 * trailing "/auth" stripped, not AUTH_API_BASE itself (which would double it up).
 */
export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | null {
  return avatarUrl ? `${AUTH_ORIGIN}${avatarUrl}` : null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Public self-registration roles accepted by auth-service's /auth/register contract. */
export type RegisterRole = 'CUSTOMER' | 'COURIER';

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  role: RegisterRole;
}

export interface AuthResponse {
  accessToken?: string;
  token?: string;
  access_token?: string;
}

export interface UserProfileResponse {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
  avatarUrl?: string | null;
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private http = inject(HttpClient);
  private router = inject(Router);

  /** sessionStorage keeps this tab's access token isolated from other tabs/roles in the same browser. */
  private tokenSignal = signal<string | null>(sessionStorage.getItem(TOKEN_STORAGE_KEY));

  isAuthenticated = computed(() => !!this.tokenSignal());

  /** Single source of truth for the authenticated user's identity, decoded from the access token. */
  currentUser = computed<DecodedAccessToken | null>(() => {
    const token = this.tokenSignal();
    return token ? decodeJwtPayload<DecodedAccessToken>(token) : null;
  });

  role = computed<AppRole | null>(() => this.currentUser()?.role ?? null);

  isAdmin = computed(() => this.role() === 'ROLE_ADMIN');
  isCustomer = computed(() => this.role() === 'ROLE_CUSTOMER');
  isCourier = computed(() => this.role() === 'ROLE_COURIER');

  /** Single in-flight refresh call shared by every concurrent caller; see refreshOnce(). */
  private refreshInFlight$: Observable<AuthResponse> | null = null;

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${AUTH_API_BASE}/login`, credentials, { withCredentials: true }).pipe(
      tap(response => this.setToken(response.accessToken ?? response.token ?? response.access_token ?? null))
    );
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${AUTH_API_BASE}/register`, payload);
  }

  getProfile(): Observable<UserProfileResponse> {
    return this.http.get<UserProfileResponse>(`${AUTH_API_BASE}/me`);
  }

  updateProfile(payload: UpdateProfileRequest): Observable<UserProfileResponse> {
    return this.http.put<UserProfileResponse>(`${AUTH_API_BASE}/me`, payload);
  }

  /**
   * Emits an HttpEvent stream (reportProgress) so callers can drive an upload progress bar;
   * the final UserProfileResponse arrives as the HttpEventType.Response event.
   */
  uploadAvatar(file: File): Observable<HttpEvent<UserProfileResponse>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UserProfileResponse>(`${AUTH_API_BASE}/me/avatar`, formData, {
      reportProgress: true,
      observe: 'events'
    });
  }

  /**
   * Avatar files are served from a Bearer-protected route with no anonymous GET, so a plain
   * `<img src>` can never load them - the browser has no way to attach an Authorization header
   * to an image request. Fetches the file through HttpClient (which does attach it via the
   * auth interceptor) and hands back an object URL the template can bind directly; the caller
   * owns revoking it.
   */
  fetchAvatarObjectUrl(resolvedAvatarUrl: string): Observable<string> {
    return this.http
      .get(resolvedAvatarUrl, { responseType: 'blob' })
      .pipe(map((blob) => URL.createObjectURL(blob)));
  }

  /**
   * Exchanges the HttpOnly refresh-token cookie for a new access token. The cookie itself
   * is never read/sent explicitly by this code - withCredentials just tells the browser to
   * include whatever cookie it already holds for this origin. Deliberately does not adopt
   * the result itself - see refreshOnce(), which verifies the returned identity first.
   */
  refresh(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${AUTH_API_BASE}/refresh`, {}, { withCredentials: true });
  }

  /**
   * Coordinates concurrent refresh attempts so that no matter how many requests fail with
   * 401 at once, only a single POST /auth/refresh is made; every caller shares its result.
   *
   * The refresh-token cookie is shared by every tab of the same browser (cookies can't be
   * scoped to a tab), so if a different role logged in in another tab, this call can come
   * back with an access token for that other user. acceptRefreshedToken() rejects it instead
   * of silently adopting it, so a role switch elsewhere in the browser can't take over this tab.
   */
  refreshOnce(): Observable<AuthResponse> {
    if (!this.refreshInFlight$) {
      const expectedSub = this.currentUser()?.sub ?? null;

      this.refreshInFlight$ = this.refresh().pipe(
        tap(response => this.acceptRefreshedToken(response, expectedSub)),
        finalize(() => { this.refreshInFlight$ = null; }),
        shareReplay(1)
      );
    }
    return this.refreshInFlight$;
  }

  /**
   * Commits a refreshed token only if it belongs to the same user this tab was already
   * signed in as. On mismatch it throws instead of calling setToken() - the interceptor's
   * existing refresh-failure handling (see authInterceptor) then clears this tab's session
   * and redirects it to /login, without touching any other tab.
   */
  private acceptRefreshedToken(response: AuthResponse, expectedSub: string | null): void {
    const token = response.accessToken ?? response.token ?? response.access_token ?? null;
    const decoded = token ? decodeJwtPayload<DecodedAccessToken>(token) : null;

    if (expectedSub !== null && decoded?.sub !== expectedSub) {
      throw new Error('Refreshed token identity does not match the current session');
    }

    this.setToken(token);
  }

  logout(): void {
    this.http.post(`${AUTH_API_BASE}/logout`, {}, { withCredentials: true }).subscribe({
      error: () => {
      }
    });
    this.clearSession();
    this.router.navigate(['/login']);
  }

  /** Clears local auth state only, without calling the backend - used after a failed refresh. */
  clearSession(): void {
    this.setToken(null);
  }

  getToken(): string | null {
    return this.tokenSignal();
  }

  private setToken(token: string | null): void {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    this.tokenSignal.set(token);
  }

}
