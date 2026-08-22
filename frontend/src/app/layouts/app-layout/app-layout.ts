import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideChevronLeft,
  LucideFiles,
  LucideFolderOpen,
  LucideMenu,
  LucideMoon,
  LucideSettings,
  LucideShare2,
  LucideSun,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { ThemeService } from '../../core/services/theme.service';
import { UiFooterComponent } from '../../shared/components/ui-footer/ui-footer';
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
    LucideSettings,
    LucideShare2,
    LucideSun,
    LucideTrash2,
    LucideX,
    UiFooterComponent,
    UiBrandLogoComponent,
  ],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
})
export class AppLayoutComponent {
  readonly theme = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);
  readonly sidebarOpen = signal(true);
  readonly mobileMenuOpen = signal(false);

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
}
