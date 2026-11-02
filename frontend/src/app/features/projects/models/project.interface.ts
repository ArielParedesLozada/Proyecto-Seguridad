export interface Project {
  id: string;
  title: string;
  owner: string;
  ownerInitials: string;
  updatedAt: string;
  updatedAtTimestamp: number;
  isShared: boolean;
  isArchived: boolean;
  role: ProjectRole;
}

export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface ProjectResponse {
  id: string;
  name: string;
  ownerName: string;
  role: ProjectRole;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

export interface SaveProjectRequest {
  name: string;
}
