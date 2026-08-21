import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { definePreset } from '@primeng/themes';

import { routes } from './app.routes';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

const LatexLabPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{indigo.50}',
      100: '{indigo.100}',
      200: '{indigo.200}',
      300: '{indigo.300}',
      400: '{indigo.400}',
      500: '{indigo.500}',
      600: '{indigo.600}',
      700: '{indigo.700}',
      800: '{indigo.800}',
      900: '{indigo.900}',
      950: '{indigo.950}',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{indigo.600}',
          contrastColor: '#ffffff',
          hoverColor: '{indigo.700}',
          activeColor: '{indigo.800}',
        },
      },
      dark: {
        primary: {
          color: '{indigo.400}',
          contrastColor: '{indigo.950}',
          hoverColor: '{indigo.300}',
          activeColor: '{indigo.200}',
        },
      },
    },
  },
});

const primeUiLicense = (globalThis as typeof globalThis & { __primeUiLicense?: string })
  .__primeUiLicense;

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    providePrimeNG({
      license: primeUiLicense,
      ripple: true,
      theme: { preset: LatexLabPreset, options: { darkModeSelector: '.app-dark' } },
    }),
  ],
};
