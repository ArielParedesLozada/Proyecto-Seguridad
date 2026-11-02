import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideFilePlus2 } from '@lucide/angular';
import { ActivatedRoute } from '@angular/router';
import { UiConfirmDialogComponent } from '../../../../shared/components/ui-confirm-dialog/ui-confirm-dialog';
import { UiFormFieldComponent } from '../../../../shared/components/ui-form-field/ui-form-field';
import { UiModalActionsComponent } from '../../../../shared/components/ui-modal-actions/ui-modal-actions';
import { UiModalComponent } from '../../../../shared/components/ui-modal/ui-modal';
import { UiSearchInputComponent } from '../../../../shared/components/ui-search-input/ui-search-input';
import { InvitationFormComponent } from '../../../collaboration/components/invitation-form/invitation-form';
import { InvitationListComponent } from '../../../collaboration/components/invitation-list/invitation-list';
import { InvitationService } from '../../../collaboration/data-access/invitation.service';
import { InvitationResponse, InvitationRole } from '../../../collaboration/models/invitation.interface';
import { ProjectAction } from '../../components/project-action-menu/project-action-menu';
import { ProjectTableComponent } from '../../components/project-table/project-table';
import { ProjectService } from '../../data-access/project.service';
import { Project, ProjectResponse, SaveProjectRequest } from '../../models/project.interface';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    LucideFilePlus2,
    UiConfirmDialogComponent,
    UiFormFieldComponent,
    UiModalActionsComponent,
    UiModalComponent,
    UiSearchInputComponent,
    ProjectTableComponent,
    InvitationFormComponent,
    InvitationListComponent,
  ],
  templateUrl: './project-list.html',
  styleUrl: './project-list.css',
})
export class ProjectListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly projectService = inject(ProjectService);
  private readonly invitationService = inject(InvitationService);

  readonly createDialogOpen = signal(false);
  readonly editDialogOpen = signal(false);
  readonly deleteDialogOpen = signal(false);
  readonly shareDialogOpen = signal(false);
  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly searchTerm = signal('');
  readonly projects = signal<Project[]>([]);
  readonly selectedProject = signal<Project | null>(null);
  readonly draftName = signal('');
  readonly shareProject = signal<Project | null>(null);
  readonly invitations = signal<InvitationResponse[]>([]);
  readonly isInviting = signal(false);
  readonly inviteError = signal('');
  readonly projectView =
    (this.route.snapshot.data['projectView'] as 'all' | 'mine' | 'shared' | 'archived' | undefined) ?? 'all';
  readonly pageTitle = {
    all: 'Todos los proyectos',
    mine: 'Mis proyectos',
    shared: 'Compartidos conmigo',
    archived: 'Proyectos archivados',
  }[this.projectView];

  readonly filteredProjects = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    const visibleProjects = this.projects().filter((project) => {
      if (this.projectView === 'mine') return project.role === 'OWNER';
      if (this.projectView === 'shared') return project.role !== 'OWNER';
      return true;
    });

    return term
      ? visibleProjects.filter((project) =>
          `${project.title} ${project.owner}`.toLocaleLowerCase().includes(term),
        )
      : visibleProjects;
  });

  async ngOnInit(): Promise<void> {
    await this.loadProjects();
  }

  openCreateDialog(): void {
    this.errorMessage.set('');
    this.draftName.set('');
    this.createDialogOpen.set(true);
  }

  openEditDialog(project: Project): void {
    if (project.role !== 'OWNER') return;
    this.selectedProject.set(project);
    this.errorMessage.set('');
    this.draftName.set(project.title);
    this.editDialogOpen.set(true);
  }

  openDeleteDialog(project: Project): void {
    if (project.role !== 'OWNER') return;
    this.selectedProject.set(project);
    this.deleteDialogOpen.set(true);
  }

  updateDraftName(event: Event): void {
    this.draftName.set((event.target as HTMLInputElement).value);
  }

  async createProject(): Promise<void> {
    if (!this.validateDraft()) return;
    this.isSaving.set(true);
    try {
      const created = await this.projectService.createProject(this.toRequest());
      this.projects.update((projects) => [this.toProject(created), ...projects]);
      this.createDialogOpen.set(false);
    } catch (error) {
      this.errorMessage.set(this.readError(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  async updateProject(): Promise<void> {
    const project = this.selectedProject();
    if (!project || !this.validateDraft()) return;
    this.isSaving.set(true);
    try {
      const updated = await this.projectService.updateProject(project.id, this.toRequest());
      this.replaceProject(this.toProject(updated));
      this.editDialogOpen.set(false);
    } catch (error) {
      this.errorMessage.set(this.readError(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  async confirmArchive(): Promise<void> {
    const project = this.selectedProject();
    if (!project) return;
    try {
      await this.projectService.deleteProject(project.id);
      this.projects.update((projects) => projects.filter((item) => item.id !== project.id));
      this.deleteDialogOpen.set(false);
    } catch (error) {
      this.errorMessage.set(this.readError(error));
    }
  }

  async handleProjectAction(event: { project: Project; action: ProjectAction }): Promise<void> {
    if (event.action === 'duplicate') {
      try {
        const copy = await this.projectService.copyProject(event.project.id);
        if (this.projectView !== 'archived') {
          this.projects.update((projects) => [this.toProject(copy), ...projects]);
        }
      } catch (error) {
        this.errorMessage.set(this.readError(error));
      }
      return;
    }
    if (event.action === 'edit') this.openEditDialog(event.project);
    if (event.action === 'archive' || event.action === 'delete') this.openDeleteDialog(event.project);
    if (event.action === 'share') await this.openShareDialog(event.project);
  }

  async openShareDialog(project: Project): Promise<void> {
    if (project.role !== 'OWNER') return;
    this.shareProject.set(project);
    this.inviteError.set('');
    this.shareDialogOpen.set(true);
    await this.loadInvitations(project.id);
  }

  async invite(request: { email: string; role: InvitationRole }): Promise<void> {
    const project = this.shareProject();
    if (!project) return;
    this.isInviting.set(true);
    try {
      await this.invitationService.invite(project.id, request);
    } catch (error) {
      this.inviteError.set(this.readError(error));
    } finally {
      this.isInviting.set(false);
      await this.loadInvitations(project.id);
    }
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    const project = this.shareProject();
    if (!project) return;
    try {
      await this.invitationService.revoke(project.id, invitationId);
    } catch (error) {
      this.inviteError.set(this.readError(error));
    } finally {
      await this.loadInvitations(project.id);
    }
  }

  async resendInvitation(invitationId: string): Promise<void> {
    const project = this.shareProject();
    if (!project) return;
    try {
      await this.invitationService.resend(project.id, invitationId);
    } catch (error) {
      this.inviteError.set(this.readError(error));
    } finally {
      await this.loadInvitations(project.id);
    }
  }

  private async loadInvitations(projectId: string): Promise<void> {
    try {
      this.invitations.set(await this.invitationService.getInvitations(projectId));
    } catch (error) {
      this.inviteError.set(this.readError(error));
    }
  }

  private async loadProjects(): Promise<void> {
    try {
      const projects = await this.projectService.getProjects(this.projectView === 'archived');
      this.projects.set(projects.map((project) => this.toProject(project)));
    } catch (error) {
      this.errorMessage.set(this.readError(error));
    }
  }

  private validateDraft(): boolean {
    const name = this.draftName().trim();
    if (!name) {
      this.errorMessage.set('El nombre del proyecto es obligatorio.');
      return false;
    }
    this.errorMessage.set('');
    return true;
  }

  private toRequest(): SaveProjectRequest {
    return { name: this.draftName() };
  }

  private replaceProject(project: Project): void {
    this.projects.update((projects) => projects.map((item) => (item.id === project.id ? project : item)));
  }

  private toProject(response: ProjectResponse): Project {
    const updatedAt = new Date(response.updatedAt);
    return {
      id: response.id,
      title: response.name,
      owner: response.ownerName,
      ownerInitials: this.initials(response.ownerName),
      updatedAt: this.formatUpdatedAt(updatedAt),
      updatedAtTimestamp: updatedAt.getTime(),
      isShared: response.role !== 'OWNER',
      isArchived: response.isArchived,
      role: response.role,
    };
  }

  private initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  }

  private formatUpdatedAt(date: Date): string {
    const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
    if (minutes < 1) return 'Editado ahora';
    if (minutes < 60) return `Editado hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Editado hace ${hours} h`;
    return `Editado el ${new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(date)}`;
  }

  private readError(error: unknown): string {
    return error instanceof Error ? error.message : 'No fue posible completar la operación.';
  }
}
