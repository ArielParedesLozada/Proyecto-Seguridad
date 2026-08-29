import { Injectable } from '@angular/core';
import { API_ROUTES } from '../../../core/constants/api.constants';
import { ProjectResponse, SaveProjectRequest } from '../models/project.interface';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  async getProjects(archived = false): Promise<ProjectResponse[]> {
    const query = archived ? '?archived=true' : '';
    return this.request<ProjectResponse[]>(`${API_ROUTES.projects.root}${query}`);
  }

  async getProject(id: string): Promise<ProjectResponse> {
    return this.request<ProjectResponse>(API_ROUTES.projects.byId(id));
  }

  async createProject(request: SaveProjectRequest): Promise<ProjectResponse> {
    return this.request<ProjectResponse>(API_ROUTES.projects.root, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async updateProject(id: string, request: SaveProjectRequest): Promise<ProjectResponse> {
    return this.request<ProjectResponse>(API_ROUTES.projects.byId(id), {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.request<void>(API_ROUTES.projects.byId(id), { method: 'DELETE' });
  }

  async copyProject(id: string): Promise<ProjectResponse> {
    return this.request<ProjectResponse>(API_ROUTES.projects.copy(id), { method: 'POST' });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_ROUTES.BASE_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      ...init,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string; title?: string } | null;
      throw new Error(body?.error ?? body?.title ?? 'No fue posible completar la operación.');
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
