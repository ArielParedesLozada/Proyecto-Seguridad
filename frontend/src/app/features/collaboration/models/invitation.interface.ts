export type InvitationRole = 'EDITOR' | 'VIEWER';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface InvitationResponse {
  id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
}

export interface CreateInvitationRequest {
  email: string;
  role: InvitationRole;
}

export interface InvitationPreviewResponse {
  projectName: string;
  invitedByName: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
}

export interface AcceptInvitationResponse {
  projectId: string;
  projectName: string;
  role: InvitationRole;
}
