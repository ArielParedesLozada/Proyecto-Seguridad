import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly darkMode = signal(false);

  toggle(): void {
    this.darkMode.update((isDark) => !isDark);
    this.document.documentElement.classList.toggle('app-dark', this.darkMode());
  }
}
