import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideBookOpen,
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
import { ThemeService } from '../../core/services/theme.service';
import { UiFooterComponent } from '../../shared/components/ui-footer/ui-footer';
import { UiTooltipComponent } from '../../shared/components/ui-tooltip/ui-tooltip';
@Component({
  selector: 'app-app-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideBookOpen,
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
  ],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
})
export class AppLayoutComponent {
  readonly theme = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);
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
  }
}
