import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { API_ROUTES } from '../constants/api.constants';

export interface CurrentUser {
  id: string;
  email: string;
  nombre: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly _currentUser = signal<CurrentUser | null>(null);

  /** Usuario autenticado actual, o `null` si no hay sesión. */
  readonly currentUser = this._currentUser.asReadonly();

  /** Iniciales del usuario para avatares (hasta 2 letras). */
  readonly userInitials = computed(() => {
    const name = this._currentUser()?.nombre?.trim();
    if (!name) return '?';
    const parts = name.split(/\s+/);
    const initials = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
    return initials.toUpperCase() || '?';
  });

  /** Obtiene el usuario actual desde el backend y lo guarda en el estado. */
  async loadCurrentUser(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this._currentUser() !== null) return;

    try {
      const response = await fetch(`${API_ROUTES.BASE_URL}${API_ROUTES.auth.me}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        this._currentUser.set(null);
        return;
      }
      const user = (await response.json()) as CurrentUser;
      this._currentUser.set(user);
    } catch {
      this._currentUser.set(null);
    }
  }

  /** Limpia el usuario guardado (p. ej. tras cerrar sesión). */
  clear(): void {
    this._currentUser.set(null);
  }
}
