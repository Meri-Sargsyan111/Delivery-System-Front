import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { roleTranslationKey } from '../../i18n/status-labels';
import { LanguageSwitcher } from '../language-switcher/language-switcher';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe, LanguageSwitcher],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {

  private authService = inject(AuthService);

  isCollapsed = false;
  isAuthenticated = this.authService.isAuthenticated;
  currentUser = this.authService.currentUser;
  roleKey = computed(() => roleTranslationKey(this.authService.role()));

  showCreateOrder = computed(() => this.authService.isAdmin() || this.authService.isCustomer());
  showCouriers = computed(() => this.authService.isAdmin());

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
  }

  logout() {
    this.authService.logout();
  }

}
