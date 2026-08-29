export type ProjectFileType = 'FILE' | 'FOLDER';

export interface ProjectFileTree {
  id: string;
  parentId: string | null;
  name: string;
  type: ProjectFileType;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile extends ProjectFileTree {
  content: string | null;
}

export interface CreateProjectFileRequest {
  parentId: string | null;
  name: string;
  type: ProjectFileType;
}
