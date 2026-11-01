import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { API_ROUTES } from '../../../../core/constants/api.constants';
import { AuthService } from '../../../../core/auth/auth.service';
import { UiButtonComponent } from '../../../../shared/components/ui-button/ui-button';
import { UiEmptyStateComponent } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiLoadingComponent } from '../../../../shared/components/ui-loading/ui-loading';
import { UiStatusBadgeComponent } from '../../../../shared/components/ui-status-badge/ui-status-badge';
import { InvitationError, InvitationService } from '../../data-access/invitation.service';
import { InvitationPreviewResponse } from '../../models/invitation.interface';

type InvitationErrorKind = 'not-found' | 'expired' | 'mismatch';

@Component({
  selector: 'app-invitation-accept',
  standalone: true,
  imports: [UiButtonComponent, UiEmptyStateComponent, UiLoadingComponent, UiStatusBadgeComponent],
  templateUrl: './invitation-accept.html',
  styleUrl: './invitation-accept.css',
})
export class InvitationAcceptComponent {
  private readonly invitationService = inject(InvitationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  readonly preview = signal<InvitationPreviewResponse | null>(null);
  readonly isLoading = signal(true);
  readonly isAccepting = signal(false);
  readonly errorMessage = signal('');
  readonly errorKind = signal<InvitationErrorKind | null>(null);

  constructor() {
    void this.loadPreview();
  }

  async accept(): Promise<void> {
    this.isAccepting.set(true);
    this.errorMessage.set('');
    try {
      const result = await this.invitationService.accept(this.token);
      await this.router.navigate(['/editor', result.projectId]);
    } catch (error) {
      this.applyError(error);
    } finally {
      this.isAccepting.set(false);
    }
  }

  logout(): void {
    this.auth.clear();
    void fetch(`${API_ROUTES.BASE_URL}${API_ROUTES.auth.logout}`, {
      method: 'POST',
      credentials: 'include',
    }).finally(() => this.router.navigateByUrl('/login'));
  }

  private async loadPreview(): Promise<void> {
    this.isLoading.set(true);
    try {
      this.preview.set(await this.invitationService.getByToken(this.token));
    } catch (error) {
      this.applyError(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private applyError(error: unknown): void {
    const status = (error as InvitationError).status;
    this.errorMessage.set(
      error instanceof Error ? error.message : 'No fue posible completar la operación.',
    );
    this.errorKind.set(status === 410 ? 'expired' : status === 403 ? 'mismatch' : 'not-found');
  }
}
