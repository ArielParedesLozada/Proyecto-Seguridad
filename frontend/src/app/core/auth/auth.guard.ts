import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { API_ROUTES } from '../constants/api.constants';

/**
 * Guard que protege las rutas autenticadas. Valida la sesión consultando el
 * endpoint `/auth/me` del backend (autenticación basada en cookies). Si el
 * usuario no está logueado, redirige a la ruta de login.
 */
export const authGuard: CanActivateFn = (): Promise<boolean | UrlTree> => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    // En el servidor no es posible validar la cookie de sesión; la protección
    // real ocurre en el navegador tras la hidratación.
    return Promise.resolve(true);
  }

  return fetch(`${API_ROUTES.BASE_URL}${API_ROUTES.auth.me}`, {
    method: 'GET',
    credentials: 'include',
  })
    .then((response) => (response.ok ? true : router.createUrlTree(['/login'])))
    .catch(() => router.createUrlTree(['/login']));
};
