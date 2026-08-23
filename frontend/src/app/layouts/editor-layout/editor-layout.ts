import { Component, signal } from '@angular/core';
import { EditorSidebarComponent } from '../../features/editor/components/editor-sidebar/editor-sidebar';
import { EditorSidePanelComponent } from '../../features/editor/components/editor-side-panel/editor-side-panel';
import { EditorToolbarComponent } from '../../features/editor/components/editor-toolbar/editor-toolbar';
import { EditorWorkspaceComponent } from '../../features/editor/components/editor-workspace/editor-workspace';
import { EditorPdfPreviewComponent } from '../../features/editor/components/editor-pdf-preview/editor-pdf-preview';
import { EditorSidebarOption } from '../../features/editor/models/editor-sidebar-option.type';
import { EditorComment } from '../../features/editor/models/editor-comment.interface';
import { UiSplitPaneComponent } from '../../shared/components/ui-split-pane/ui-split-pane';

@Component({
  selector: 'app-editor-layout',
  standalone: true,
  imports: [
    EditorSidebarComponent,
    EditorSidePanelComponent,
    EditorToolbarComponent,
    EditorWorkspaceComponent,
    EditorPdfPreviewComponent,
    UiSplitPaneComponent,
  ],
  templateUrl: './editor-layout.html',
  styleUrl: './editor-layout.css',
})
export class EditorLayoutComponent {
  readonly activeSidebarOption = signal<EditorSidebarOption>('files');
  readonly isSidePanelVisible = signal(true);
  readonly activeEditorFile = signal<string | null>('main.tex');
  readonly comments = signal<EditorComment[]>([]);
  readonly commentFocusRequest = signal(0);

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

  selectEditorFile(fileName: string): void {
    this.activeEditorFile.set(fileName);
  }

  updateActiveEditorFile(fileName: string | null): void {
    this.activeEditorFile.set(fileName);
  }

  openCommentsPanel(): void {
    this.activeSidebarOption.set('comments');
    this.isSidePanelVisible.set(true);
    this.commentFocusRequest.update((request) => request + 1);
  }

  addComment(content: string): void {
    this.comments.update((comments) => [
      ...comments,
      {
        id: `comment-${Date.now()}`,
        author: 'Diego',
        content,
        createdAt: new Intl.DateTimeFormat('es-EC', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
      },
    ]);
  }
}
