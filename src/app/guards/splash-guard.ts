import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const SPLASH_SHOWN_KEY = 'splash_shown';

/**
 * Gates the root route so the cinematic splash plays once per browser session, before
 * the app's normal entry flow (authGuard/Dashboard) takes over. Runs first in canActivate
 * so it never interferes with authGuard's own redirect decision. Splash.ts sets the
 * sessionStorage flag once its animation completes and it navigates to /login.
 */
export const splashGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (sessionStorage.getItem(SPLASH_SHOWN_KEY)) {
    return true;
  }

  return router.parseUrl('/splash');
};