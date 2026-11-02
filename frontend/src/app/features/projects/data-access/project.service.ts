import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../core/http/api-client';
import { API_ROUTES } from '../../../core/constants/api.constants';
import { ProjectResponse, SaveProjectRequest } from '../models/project.interface';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly api = inject(ApiClient);

  async getProjects(archived = false): Promise<ProjectResponse[]> {
    const query = archived ? '?archived=true' : '';
    return this.api.request<ProjectResponse[]>(`${API_ROUTES.projects.root}${query}`);
  }

  async getProject(id: string): Promise<ProjectResponse> {
    return this.api.request<ProjectResponse>(API_ROUTES.projects.byId(id));
  }

  async createProject(request: SaveProjectRequest): Promise<ProjectResponse> {
    return this.api.request<ProjectResponse>(API_ROUTES.projects.root, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async updateProject(id: string, request: SaveProjectRequest): Promise<ProjectResponse> {
    return this.api.request<ProjectResponse>(API_ROUTES.projects.byId(id), {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.api.request<void>(API_ROUTES.projects.byId(id), { method: 'DELETE' });
  }

  async copyProject(id: string): Promise<ProjectResponse> {
    return this.api.request<ProjectResponse>(API_ROUTES.projects.copy(id), { method: 'POST' });
  }
}
