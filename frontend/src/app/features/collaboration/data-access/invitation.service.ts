import { Injectable, inject } from '@angular/core';
import { ApiClient, ApiError } from '../../../core/http/api-client';
import { API_ROUTES } from '../../../core/constants/api.constants';
import {
  AcceptInvitationResponse,
  CreateInvitationRequest,
  InvitationPreviewResponse,
  InvitationResponse,
} from '../models/invitation.interface';

export type InvitationError = ApiError;

@Injectable({ providedIn: 'root' })
export class InvitationService {
  private readonly api = inject(ApiClient);

  async getInvitations(projectId: string): Promise<InvitationResponse[]> {
    return this.api.request<InvitationResponse[]>(API_ROUTES.projects.invitations.root(projectId));
  }

  async invite(projectId: string, request: CreateInvitationRequest): Promise<InvitationResponse> {
    return this.api.request<InvitationResponse>(API_ROUTES.projects.invitations.root(projectId), {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async revoke(projectId: string, invitationId: string): Promise<void> {
    await this.api.request<void>(API_ROUTES.projects.invitations.byId(projectId, invitationId), {
      method: 'DELETE',
    });
  }

  async resend(projectId: string, invitationId: string): Promise<InvitationResponse> {
    return this.api.request<InvitationResponse>(API_ROUTES.projects.invitations.resend(projectId, invitationId), {
      method: 'POST',
    });
  }

  async getByToken(token: string): Promise<InvitationPreviewResponse> {
    return this.api.request<InvitationPreviewResponse>(API_ROUTES.invitations.byToken(token));
  }

  async accept(token: string): Promise<AcceptInvitationResponse> {
    return this.api.request<AcceptInvitationResponse>(API_ROUTES.invitations.accept(token), {
      method: 'POST',
    });
  }
}
