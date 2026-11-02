import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideFileText } from '@lucide/angular';
import { Project } from '../../models/project.interface';
import { ProjectActionMenuComponent } from '../project-action-menu/project-action-menu';
import { ProjectAction } from '../project-action-menu/project-action-menu';

@Component({
  selector: 'tr[app-project-table-row]',
  standalone: true,
  imports: [LucideFileText, ProjectActionMenuComponent, RouterLink],
  host: { '[class.is-selected]': 'selected()' },
  templateUrl: './project-table-row.html',
  styleUrl: './project-table-row.css',
})
export class ProjectTableRowComponent {
  readonly project = input.required<Project>();
  readonly selected = input(false);
  readonly selectionChanged = output<boolean>();
  readonly actionSelected = output<ProjectAction>();
}
