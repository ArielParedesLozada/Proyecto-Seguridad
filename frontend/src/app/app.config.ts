import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

const primeUiLicense = (globalThis as typeof globalThis & { __primeUiLicense?: string }).__primeUiLicense;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    providePrimeNG({ license: primeUiLicense, ripple: true, theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } } })
  ]
};
