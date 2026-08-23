import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideChevronLeft,
  LucideFiles,
  LucideFolderOpen,
  LucideMenu,
  LucideMoon,
  LucideLogOut,
  LucideSettings,
  LucideSun,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { API_ROUTES } from '../../core/constants/api.constants';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { UiFooterComponent } from '../../shared/components/ui-footer/ui-footer';
import { UiTooltipComponent } from '../../shared/components/ui-tooltip/ui-tooltip';
import { UiBrandLogoComponent } from '../../shared/components/ui-brand-logo/ui-brand-logo';
@Component({
  selector: 'app-app-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideChevronLeft,
    LucideFiles,
    LucideFolderOpen,
    LucideMenu,
    LucideMoon,
    LucideLogOut,
    LucideSettings,
    LucideSun,
    LucideTrash2,
    LucideX,
    UiFooterComponent,
    UiTooltipComponent,
    UiBrandLogoComponent,
  ],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
})
export class AppLayoutComponent {
  readonly theme = inject(ThemeService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    this.auth.loadCurrentUser();
  }
  readonly sidebarOpen = signal(true);
  readonly mobileMenuOpen = signal(false);
  readonly settingsMenuOpen = signal(false);
  readonly profileMenuOpen = signal(false);

  toggleSidebar(): void {
    if (isPlatformBrowser(this.platformId) && window.matchMedia('(max-width: 760px)').matches) {
      this.mobileMenuOpen.update((isOpen) => !isOpen);
      return;
    }
    this.sidebarOpen.update((isOpen) => !isOpen);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleSettingsMenu(): void {
    this.settingsMenuOpen.update((isOpen) => !isOpen);
    this.profileMenuOpen.set(false);
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen.update((isOpen) => !isOpen);
    this.settingsMenuOpen.set(false);
  }

  logout(): void {
    this.settingsMenuOpen.set(false);
    this.profileMenuOpen.set(false);
    this.auth.clear();
    void fetch(`${API_ROUTES.BASE_URL}${API_ROUTES.auth.logout}`, {
      method: 'POST',
      credentials: 'include',
    })
      .catch(() => {
        // El cierre de sesión en el servidor puede fallar, pero igualmente
        // redirigimos al usuario fuera del área autenticada.
      })
      .finally(() => {
        this.router.navigateByUrl('/login');
      });
  }
}
