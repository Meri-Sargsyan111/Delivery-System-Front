import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppRole, AuthService } from '../services/auth.service';

/**
 * Restricts a route to a set of roles. Must run after authGuard in the route's
 * canActivate array - it assumes the user is already authenticated and only decides
 * whether their role is allowed, redirecting to the dashboard otherwise.
 */
export function roleGuard(allowedRoles: AppRole[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const role = authService.role();

    if (role && allowedRoles.includes(role)) {
      return true;
    }

    return router.parseUrl('/');
  };
}
