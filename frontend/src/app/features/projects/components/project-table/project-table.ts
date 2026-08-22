import { Component, computed, input, signal } from '@angular/core';
import { UiEmptyStateComponent } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { Project } from '../../models/project.interface';
import { ProjectTableRowComponent } from '../project-table-row/project-table-row';

type SortKey = 'title' | 'owner' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-project-table',
  standalone: true,
  imports: [ProjectTableRowComponent, UiEmptyStateComponent],
  templateUrl: './project-table.html',
  styleUrl: './project-table.css',
})
export class ProjectTableComponent {
  readonly projects = input.required<Project[]>();
  readonly sortKey = signal<SortKey | null>(null);
  readonly sortDirection = signal<SortDirection>('desc');
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly sortedProjects = computed(() => {
    const key = this.sortKey();
    if (!key) return [...this.projects()];

    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    const collator = new Intl.Collator('es', { sensitivity: 'base' });

    return [...this.projects()].sort((first, second) => {
      const comparison =
        key === 'updatedAt'
          ? first.updatedAtTimestamp - second.updatedAtTimestamp
          : collator.compare(first[key], second[key]);
      return comparison * direction;
    });
  });

  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }

    this.sortKey.set(key);
    this.sortDirection.set(key === 'updatedAt' ? 'desc' : 'asc');
  }

  sortIcon(key: SortKey): string {
    if (this.sortKey() !== key) return '';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  sortState(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  isSelected(projectId: string): boolean {
    return this.selectedIds().has(projectId);
  }

  readonly allSelected = computed(
    () => this.projects().length > 0 && this.projects().every((project) => this.isSelected(project.id)),
  );

  readonly someSelected = computed(
    () => !this.allSelected() && this.projects().some((project) => this.isSelected(project.id)),
  );

  toggleAll(selected: boolean): void {
    this.selectedIds.set(selected ? new Set(this.projects().map((project) => project.id)) : new Set());
  }

  toggleProject(projectId: string, selected: boolean): void {
    this.selectedIds.update((currentSelection) => {
      const nextSelection = new Set(currentSelection);
      selected ? nextSelection.add(projectId) : nextSelection.delete(projectId);
      return nextSelection;
    });
  }
}
