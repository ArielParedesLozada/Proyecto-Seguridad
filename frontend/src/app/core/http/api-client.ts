import { Injectable, inject } from '@angular/core';
import { API_ROUTES } from '../constants/api.constants';
import { CryptoTransport } from '../crypto/crypto-transport';
import { SessionKeyService } from '../crypto/session-key.service';

export interface ApiError extends Error {
  status: number;
}

const EXEMPT_PREFIXES = ['/auth', '/crypto/session', '/swagger'];

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly cryptoTransport = inject(CryptoTransport);
  private readonly sessionKey = inject(SessionKeyService);

  async request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
    const exempt = EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));

    if (!exempt && !this.sessionKey.key()) {
      await this.sessionKey.load();
    }

    const finalInit: RequestInit = { ...init };
    if (!exempt && init.body) {
      finalInit.body = await this.cryptoTransport.wrap(JSON.parse(init.body as string));
    }

    const response = await fetch(`${API_ROUTES.BASE_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      ...finalInit,
    });

    if (response.status === 204) return undefined as T;

    const rawText = await response.text();

    if (exempt) {
      if (!response.ok) throw this.toError(this.readPlainError(rawText), response.status);
      return rawText ? (JSON.parse(rawText) as T) : (undefined as T);
    }

    try {
      const body = rawText ? await this.cryptoTransport.unwrap<T & { error?: string; title?: string }>(rawText) : undefined;
      if (!response.ok) throw this.toError(body?.error ?? body?.title, response.status);
      return body as T;
    } catch (unwrapError) {
      // El 400 que genera el propio middleware ante un sobre invalido viaja
      // SIN cifrar (la clave con la que fallo tampoco podria descifrar la
      // explicacion). Si la clave de sesion quedo obsolete (rotó en otra
      // pestaña), reintentamos una vez con una clave fresca.
      if (response.status === 400 && !isRetry) {
        await this.sessionKey.load();
        return this.request<T>(path, init, true);
      }
      if (response.status === 400) throw this.toError(this.readPlainError(rawText), response.status);
      throw unwrapError;
    }
  }

  private readPlainError(rawText: string): string | undefined {
    try {
      return (JSON.parse(rawText) as { error?: string; title?: string }).error;
    } catch {
      return undefined;
    }
  }

  private toError(message: string | undefined, status: number): ApiError {
    const error = new Error(message ?? 'No fue posible completar la operación.') as ApiError;
    error.status = status;
    return error;
  }
}
