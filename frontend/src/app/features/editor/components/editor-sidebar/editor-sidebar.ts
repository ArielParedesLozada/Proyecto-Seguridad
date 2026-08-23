import { Component, input, output } from '@angular/core';
import { LucideFiles, LucideMessageSquare, LucideSearch } from '@lucide/angular';
import { UiTooltipComponent } from '../../../../shared/components/ui-tooltip/ui-tooltip';
import { EditorSidebarOption } from '../../models/editor-sidebar-option.type';

@Component({
  selector: 'app-editor-sidebar',
  standalone: true,
  imports: [LucideFiles, LucideMessageSquare, LucideSearch, UiTooltipComponent],
  templateUrl: './editor-sidebar.html',
  styleUrl: './editor-sidebar.css',
})
export class EditorSidebarComponent {
  readonly activeOption = input<EditorSidebarOption>('files');
  readonly optionSelected = output<EditorSidebarOption>();

  selectOption(option: EditorSidebarOption): void {
    this.optionSelected.emit(option);
  }
}
