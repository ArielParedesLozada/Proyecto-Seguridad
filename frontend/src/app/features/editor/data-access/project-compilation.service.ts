import { Injectable } from '@angular/core';
import { API_ROUTES } from '../../../core/constants/api.constants';

@Injectable({ providedIn: 'root' })
export class ProjectCompilationService {
  async compile(projectId: string): Promise<Blob> {
    const response = await fetch(`${API_ROUTES.BASE_URL}${API_ROUTES.projects.compile(projectId)}`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/pdf' },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string; title?: string } | null;
      throw new Error(body?.error ?? body?.title ?? 'No fue posible generar el PDF.');
    }

    return response.blob();
  }
}
