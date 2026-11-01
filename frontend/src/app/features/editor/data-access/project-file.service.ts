import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../../core/http/api-client';
import { API_ROUTES } from '../../../core/constants/api.constants';
import {
  CreateProjectFileRequest,
  ProjectFile,
  ProjectFileTree,
} from '../models/project-file.interface';

@Injectable({ providedIn: 'root' })
export class ProjectFileService {
  private readonly api = inject(ApiClient);

  getFiles(projectId: string): Promise<ProjectFileTree[]> {
    return this.api.request<ProjectFileTree[]>(API_ROUTES.projects.files.root(projectId));
  }

  getFile(projectId: string, fileId: string): Promise<ProjectFile> {
    return this.api.request<ProjectFile>(API_ROUTES.projects.files.byId(projectId, fileId));
  }

  createFile(projectId: string, request: CreateProjectFileRequest): Promise<ProjectFile> {
    return this.api.request<ProjectFile>(API_ROUTES.projects.files.root(projectId), {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  renameFile(projectId: string, fileId: string, name: string): Promise<ProjectFile> {
    return this.api.request<ProjectFile>(API_ROUTES.projects.files.byId(projectId, fileId), {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  saveContent(projectId: string, fileId: string, content: string): Promise<ProjectFile> {
    return this.api.request<ProjectFile>(API_ROUTES.projects.files.content(projectId, fileId), {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteFile(projectId: string, fileId: string): Promise<void> {
    await this.api.request<void>(API_ROUTES.projects.files.byId(projectId, fileId), { method: 'DELETE' });
  }
}
