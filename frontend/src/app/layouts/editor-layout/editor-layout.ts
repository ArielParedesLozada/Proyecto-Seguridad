import { Component, signal } from '@angular/core';
import { EditorSidebarComponent } from '../../features/editor/components/editor-sidebar/editor-sidebar';
import { EditorSidePanelComponent } from '../../features/editor/components/editor-side-panel/editor-side-panel';
import { EditorToolbarComponent } from '../../features/editor/components/editor-toolbar/editor-toolbar';
import { EditorSidebarOption } from '../../features/editor/models/editor-sidebar-option.type';
import { UiSplitPaneComponent } from '../../shared/components/ui-split-pane/ui-split-pane';

@Component({
  selector: 'app-editor-layout',
  standalone: true,
  imports: [EditorSidebarComponent, EditorSidePanelComponent, EditorToolbarComponent, UiSplitPaneComponent],
  templateUrl: './editor-layout.html',
  styleUrl: './editor-layout.css',
})
export class EditorLayoutComponent {
  readonly activeSidebarOption = signal<EditorSidebarOption>('files');
  readonly isSidePanelVisible = signal(true);

  toggleSidePanelFromSidebar(option: EditorSidebarOption): void {
    if (this.activeSidebarOption() === option) {
      this.isSidePanelVisible.update((isVisible) => !isVisible);
      return;
    }

    this.activeSidebarOption.set(option);
    this.isSidePanelVisible.set(true);
  }

  toggleSidePanel(): void {
    this.isSidePanelVisible.update((isVisible) => !isVisible);
  }
}
