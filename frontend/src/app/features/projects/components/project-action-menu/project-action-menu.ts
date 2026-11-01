import { Component, input, output } from '@angular/core';
import {
  LucideArchive,
  LucideCopy,
  LucideDownload,
  LucideFileText,
  LucidePencil,
  LucideTrash2,
  LucideUserPlus,
} from '@lucide/angular';
import { UiTooltipComponent } from '../../../../shared/components/ui-tooltip/ui-tooltip';

export type ProjectAction = 'duplicate' | 'download' | 'export-pdf' | 'share' | 'edit' | 'archive' | 'delete';

@Component({
  selector: 'app-project-action-menu',
  standalone: true,
  imports: [
    LucideArchive,
    LucideCopy,
    LucideDownload,
    LucideFileText,
    LucidePencil,
    LucideTrash2,
    LucideUserPlus,
    UiTooltipComponent,
  ],
  templateUrl: './project-action-menu.html',
  styleUrl: './project-action-menu.css',
})
export class ProjectActionMenuComponent {
  readonly projectTitle = input.required<string>();
  readonly canManage = input(false);
  readonly actionSelected = output<ProjectAction>();
}
