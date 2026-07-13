import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AUTH_API_BASE, AuthService } from '../services/auth.service';

const NON_RETRYABLE_AUTH_PATHS = ['/login', '/register', '/refresh', '/logout'];

function isNonRetryableAuthRequest(url: string): boolean {
  return NON_RETRYABLE_AUTH_PATHS.some(path => url === `${AUTH_API_BASE}${path}`);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.getToken();
  const authorizedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isNonRetryableAuthRequest(req.url)) {
        return throwError(() => error);
      }

      return authService.refreshOnce().pipe(
        switchMap(() => {
          const newToken = authService.getToken();
          const retriedReq = newToken
            ? req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
            : req;
          return next(retriedReq);
        }),
        catchError((refreshError: unknown) => {
          authService.clearSession();
          router.navigate(['/login']);
          return throwError(() => refreshError);
        })
      );
    })
  );
};