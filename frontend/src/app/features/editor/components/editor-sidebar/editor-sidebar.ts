import { Component, output, signal } from '@angular/core';
import { LucideFiles, LucideSearch } from '@lucide/angular';
import { UiTooltipComponent } from '../../../../shared/components/ui-tooltip/ui-tooltip';
import { EditorSidebarOption } from '../../models/editor-sidebar-option.type';

@Component({
  selector: 'app-editor-sidebar',
  standalone: true,
  imports: [LucideFiles, LucideSearch, UiTooltipComponent],
  templateUrl: './editor-sidebar.html',
  styleUrl: './editor-sidebar.css',
})
export class EditorSidebarComponent {
  readonly activeOption = signal<EditorSidebarOption>('files');
  readonly optionSelected = output<EditorSidebarOption>();

  selectOption(option: EditorSidebarOption): void {
    this.activeOption.set(option);
    this.optionSelected.emit(option);
  }
}
