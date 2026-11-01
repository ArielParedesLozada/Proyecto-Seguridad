import { Injectable } from '@angular/core';
import { API_ROUTES } from '../constants/api.constants';

export interface ApiError extends Error {
  status: number;
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_ROUTES.BASE_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      ...init,
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string; title?: string } | null;
      const error = new Error(
        body?.error ?? body?.title ?? 'No fue posible completar la operación.',
      ) as ApiError;
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
