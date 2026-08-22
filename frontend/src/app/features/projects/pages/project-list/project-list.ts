import { Component, computed, inject, signal } from '@angular/core';
import { LucideFilePlus2 } from '@lucide/angular';
import { ActivatedRoute } from '@angular/router';
import { UiModalActionsComponent } from '../../../../shared/components/ui-modal-actions/ui-modal-actions';
import { UiModalComponent } from '../../../../shared/components/ui-modal/ui-modal';
import { UiSearchInputComponent } from '../../../../shared/components/ui-search-input/ui-search-input';
import { ProjectTableComponent } from '../../components/project-table/project-table';
import { Project } from '../../models/project.interface';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    LucideFilePlus2,
    UiModalActionsComponent,
    UiModalComponent,
    UiSearchInputComponent,
    ProjectTableComponent,
  ],
  templateUrl: './project-list.html',
  styleUrl: './project-list.css',
})
export class ProjectListComponent {
  private readonly route = inject(ActivatedRoute);
  readonly createDialogOpen = signal(false);
  readonly searchTerm = signal('');
  readonly projectView =
    (this.route.snapshot.data['projectView'] as
      'all' | 'mine' | 'shared' | 'archived' | undefined) ?? 'all';
  readonly pageTitle = {
    all: 'Todos los proyectos',
    mine: 'Mis proyectos',
    shared: 'Compartidos conmigo',
    archived: 'Proyectos archivados',
  }[this.projectView];
  readonly projects: Project[] = [
    {
      id: '1',
      title: 'Informe de seguridad',
      description: 'Documentación del proyecto de Seguridad del Software',
      owner: 'Diego',
      ownerInitials: 'DS',
      updatedAt: 'Editado hace 12 min',
      updatedAtTimestamp: 1787348880000,
      isShared: false,
      isArchived: false,
    },
    {
      id: '2',
      title: 'Artículo de investigación',
      description: 'Borrador para la revisión bibliográfica',
      owner: 'Ana Martínez',
      ownerInitials: 'AM',
      updatedAt: 'Editado ayer',
      updatedAtTimestamp: 1787263200000,
      isShared: true,
      isArchived: false,
    },
    {
      id: '3',
      title: 'Propuesta de tesis',
      description: 'Plan de trabajo y cronograma inicial',
      owner: 'Diego',
      ownerInitials: 'DS',
      updatedAt: 'Editado el lunes',
      updatedAtTimestamp: 1787004000000,
      isShared: false,
      isArchived: false,
    },
    {
      id: '4',
      title: 'Manual de usuario',
      description: 'Guía de uso de la plataforma',
      owner: 'Carlos Vera',
      ownerInitials: 'CV',
      updatedAt: 'Editado hace 4 días',
      updatedAtTimestamp: 1786917600000,
      isShared: true,
      isArchived: false,
    },
    {
      id: '5',
      title: 'Resultados de pruebas',
      description: 'Evidencias y métricas de validación',
      owner: 'Diego',
      ownerInitials: 'DS',
      updatedAt: 'Editado hace una semana',
      updatedAtTimestamp: 1786744800000,
      isShared: false,
      isArchived: false,
    },
    {
      id: '6',
      title: 'Proyecto archivado',
      description: 'Entrega final del período anterior',
      owner: 'Diego',
      ownerInitials: 'DS',
      updatedAt: 'Editado en junio',
      updatedAtTimestamp: 1780272000000,
      isShared: false,
      isArchived: true,
    },
  ];

  readonly filteredProjects = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    const visibleProjects = this.projects.filter((project) => {
      if (this.projectView === 'mine') return project.ownerInitials === 'DS' && !project.isArchived;
      if (this.projectView === 'shared') return project.isShared && !project.isArchived;
      if (this.projectView === 'archived') return project.isArchived;
      return !project.isArchived;
    });
    return term
      ? visibleProjects.filter((project) =>
          `${project.title} ${project.owner}`.toLocaleLowerCase().includes(term),
        )
      : visibleProjects;
  });
}
