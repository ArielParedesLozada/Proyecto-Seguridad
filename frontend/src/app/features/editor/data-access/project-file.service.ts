import { Injectable } from '@angular/core';
import { API_ROUTES } from '../../../core/constants/api.constants';
import {
  CreateProjectFileRequest,
  ProjectFile,
  ProjectFileTree,
} from '../models/project-file.interface';

@Injectable({ providedIn: 'root' })
export class ProjectFileService {
  getFiles(projectId: string): Promise<ProjectFileTree[]> {
    return this.request<ProjectFileTree[]>(API_ROUTES.projects.files.root(projectId));
  }

  getFile(projectId: string, fileId: string): Promise<ProjectFile> {
    return this.request<ProjectFile>(API_ROUTES.projects.files.byId(projectId, fileId));
  }

  createFile(projectId: string, request: CreateProjectFileRequest): Promise<ProjectFile> {
    return this.request<ProjectFile>(API_ROUTES.projects.files.root(projectId), {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  renameFile(projectId: string, fileId: string, name: string): Promise<ProjectFile> {
    return this.request<ProjectFile>(API_ROUTES.projects.files.byId(projectId, fileId), {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  saveContent(projectId: string, fileId: string, content: string): Promise<ProjectFile> {
    return this.request<ProjectFile>(API_ROUTES.projects.files.content(projectId, fileId), {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteFile(projectId: string, fileId: string): Promise<void> {
    await this.request<void>(API_ROUTES.projects.files.byId(projectId, fileId), { method: 'DELETE' });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_ROUTES.BASE_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      ...init,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string; title?: string } | null;
      throw new Error(body?.error ?? body?.title ?? 'No fue posible completar la operaciÃ³n.');
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
