import { Component, input, output } from '@angular/core';
import { UiButtonComponent } from '../../../../shared/components/ui-button/ui-button';
import { UiEmptyStateComponent } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiStatusBadgeComponent } from '../../../../shared/components/ui-status-badge/ui-status-badge';
import { InvitationResponse, InvitationStatus } from '../../models/invitation.interface';

const TONE_BY_STATUS: Record<InvitationStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING: 'neutral',
  ACCEPTED: 'success',
  REVOKED: 'danger',
  EXPIRED: 'warning',
};

@Component({
  selector: 'app-invitation-list',
  standalone: true,
  imports: [UiButtonComponent, UiEmptyStateComponent, UiStatusBadgeComponent],
  templateUrl: './invitation-list.html',
  styleUrl: './invitation-list.css',
})
export class InvitationListComponent {
  readonly invitations = input.required<InvitationResponse[]>();
  readonly revokeRequested = output<string>();
  readonly resendRequested = output<string>();

  canManage(invitation: InvitationResponse): boolean {
    return invitation.status === 'PENDING' || invitation.status === 'EXPIRED';
  }

  tone(status: InvitationStatus): 'success' | 'warning' | 'danger' | 'neutral' {
    return TONE_BY_STATUS[status];
  }

  roleLabel(invitation: InvitationResponse): string {
    return invitation.role === 'EDITOR' ? 'Editor' : 'Lector';
  }

  formatExpiresAt(expiresAt: string): string {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(expiresAt));
  }
}
