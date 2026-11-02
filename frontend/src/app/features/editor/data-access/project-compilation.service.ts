import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../core/http/api-client';
import { API_ROUTES } from '../../../core/constants/api.constants';

interface CompileResponse {
  pdf: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectCompilationService {
  private readonly api = inject(ApiClient);

  async compile(projectId: string): Promise<Blob> {
    const { pdf } = await this.api.request<CompileResponse>(API_ROUTES.projects.compile(projectId), {
      method: 'POST',
    });

    const binary = atob(pdf);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    return new Blob([bytes], { type: 'application/pdf' });
  }
}
