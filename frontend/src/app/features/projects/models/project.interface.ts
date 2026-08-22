export interface Project {
  id: string;
  title: string;
  description: string;
  owner: string;
  ownerInitials: string;
  updatedAt: string;
  updatedAtTimestamp: number;
  isShared: boolean;
  isArchived: boolean;
}
