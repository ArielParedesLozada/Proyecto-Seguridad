import { Component, signal } from '@angular/core';
import {
  LucideArrowUpRight,
  LucideEllipsis,
  LucideFilePlus2,
  LucideFileText,
  LucideLayoutTemplate,
  LucideUpload,
} from '@lucide/angular';
import { UiModalComponent } from '../../../../shared/components/ui-modal/ui-modal';
import { UiModalActionsComponent } from '../../../../shared/components/ui-modal-actions/ui-modal-actions';
import { UiActionCardComponent } from '../../../../shared/components/ui-action-card/ui-action-card';
import { UiSearchInputComponent } from '../../../../shared/components/ui-search-input/ui-search-input';
import { UiStatusBadgeComponent } from '../../../../shared/components/ui-status-badge/ui-status-badge';

interface MockProject {
  name: string;
  description: string;
  updatedAt: string;
  status: 'Compilado' | 'Con cambios';
  initials: string;
}
@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    UiModalComponent,
    UiModalActionsComponent,
    UiActionCardComponent,
    UiSearchInputComponent,
    UiStatusBadgeComponent,
    LucideArrowUpRight,
    LucideEllipsis,
    LucideFilePlus2,
    LucideFileText,
    LucideLayoutTemplate,
    LucideUpload,
  ],
  templateUrl: './project-list.html',
  styleUrl: './project-list.css',
})
export class ProjectListComponent {
  readonly createDialogOpen = signal(false);
  readonly projects: MockProject[] = [
    {
      name: 'Informe de seguridad',
      description: 'Documentación del proyecto de Seguridad del Software',
      updatedAt: 'Editado hace 12 min',
      status: 'Compilado',
      initials: 'DS',
    },
    {
      name: 'Artículo de investigación',
      description: 'Borrador para la revisión bibliográfica',
      updatedAt: 'Editado ayer',
      status: 'Con cambios',
      initials: 'AM',
    },
    {
      name: 'Propuesta de tesis',
      description: 'Plan de trabajo y cronograma inicial',
      updatedAt: 'Editado el lunes',
      status: 'Compilado',
      initials: 'DS',
    },
  ];
}
