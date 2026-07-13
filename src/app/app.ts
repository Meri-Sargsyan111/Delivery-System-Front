import { Component, computed, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Navbar } from './components/navbar/navbar';
import { TranslatePipe } from './i18n/translate.pipe';
import { AuthService } from './services/auth.service';
import { roleTranslationKey } from './i18n/status-labels';

const CHROMELESS_ROUTES = ['/splash', '/login', '/register', '/about', '/how-it-works', '/technologies'];

/** Maps a route prefix to the existing nav.* translation key used for its sidebar label,
 *  so the topbar's section title is always in sync with the active nav item - no new copy. */
const ROUTE_TITLE_KEYS: { prefix: string; key: string; icon: string }[] = [
  { prefix: '/create-order', key: 'nav.createOrder', icon: 'bi-plus-circle' },
  { prefix: '/orders', key: 'nav.orders', icon: 'bi-box-seam' },
  { prefix: '/tracking', key: 'nav.tracking', icon: 'bi-search' },
  { prefix: '/live-tracking', key: 'nav.liveTracking', icon: 'bi-geo-alt' },
  { prefix: '/notifications', key: 'nav.notifications', icon: 'bi-bell' },
  { prefix: '/couriers', key: 'nav.couriers', icon: 'bi-people' },
  { prefix: '/profile', key: 'nav.profile', icon: 'bi-person-badge' },
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Navbar, RouterOutlet, RouterLink, TranslatePipe, NgClass],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {

  private router = inject(Router);
  private authService = inject(AuthService);

  currentUser = this.authService.currentUser;
  roleKey = computed(() => roleTranslationKey(this.authService.role()));

  /** `email` is an optional JWT claim; `sub` always is - falls back to it so this never
   *  throws on a token that only carries the subject. */
  userIdentifier = computed(() => this.currentUser()?.email ?? this.currentUser()?.sub ?? '');
  userInitial = computed(() => this.userIdentifier().charAt(0).toUpperCase());

  isChromeless = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => CHROMELESS_ROUTES.some(route => event.urlAfterRedirects.startsWith(route)))
    ),
    { initialValue: CHROMELESS_ROUTES.some(route => this.router.url.startsWith(route)) }
  );

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  /** Purely a display label for the topbar - reuses the same nav.* keys the sidebar already
   *  renders, so it never falls out of sync and adds no new translation content. */
  sectionTitle = computed(() => {
    const url = this.currentUrl();
    const match = ROUTE_TITLE_KEYS.find(route => url.startsWith(route.prefix));
    return match ?? { key: 'nav.dashboard', icon: 'bi-grid-1x2' };
  });

}
