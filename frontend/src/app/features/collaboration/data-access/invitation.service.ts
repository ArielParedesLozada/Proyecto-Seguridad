import { Injectable } from '@angular/core';
import { API_ROUTES } from '../../../core/constants/api.constants';
import {
  AcceptInvitationResponse,
  CreateInvitationRequest,
  InvitationPreviewResponse,
  InvitationResponse,
} from '../models/invitation.interface';

export interface InvitationError extends Error {
  status: number;
}

@Injectable({ providedIn: 'root' })
export class InvitationService {
  async getInvitations(projectId: string): Promise<InvitationResponse[]> {
    return this.request<InvitationResponse[]>(API_ROUTES.projects.invitations.root(projectId));
  }

  async invite(projectId: string, request: CreateInvitationRequest): Promise<InvitationResponse> {
    return this.request<InvitationResponse>(API_ROUTES.projects.invitations.root(projectId), {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async revoke(projectId: string, invitationId: string): Promise<void> {
    await this.request<void>(API_ROUTES.projects.invitations.byId(projectId, invitationId), {
      method: 'DELETE',
    });
  }

  async resend(projectId: string, invitationId: string): Promise<InvitationResponse> {
    return this.request<InvitationResponse>(API_ROUTES.projects.invitations.resend(projectId, invitationId), {
      method: 'POST',
    });
  }

  async getByToken(token: string): Promise<InvitationPreviewResponse> {
    return this.requestWithStatus<InvitationPreviewResponse>(API_ROUTES.invitations.byToken(token));
  }

  async accept(token: string): Promise<AcceptInvitationResponse> {
    return this.requestWithStatus<AcceptInvitationResponse>(API_ROUTES.invitations.accept(token), {
      method: 'POST',
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_ROUTES.BASE_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      ...init,
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string; title?: string } | null;
      throw new Error(body?.error ?? body?.title ?? 'No fue posible completar la operación.');
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  private async requestWithStatus<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_ROUTES.BASE_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      ...init,
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string; title?: string } | null;
      const error = new Error(
        body?.error ?? body?.title ?? 'No fue posible completar la operación.',
      ) as InvitationError;
      error.status = response.status;
      throw error;
    }

    return response.json() as Promise<T>;
  }
}
