import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { API_ROUTES } from '../constants/api.constants';

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

@Injectable({ providedIn: 'root' })
export class SessionKeyService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly _key = signal<CryptoKey | null>(null);
  readonly key = this._key.asReadonly();

  async load(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const response = await fetch(`${API_ROUTES.BASE_URL}${API_ROUTES.crypto.session}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      this._key.set(null);
      throw new Error('No fue posible obtener la clave de sesión.');
    }

    const body = (await response.json()) as { key: string };
    const keyBytes = fromBase64(body.key);
    const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
    this._key.set(cryptoKey);
  }

  clear(): void {
    this._key.set(null);
  }
}
