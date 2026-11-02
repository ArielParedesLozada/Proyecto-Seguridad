import { Component, computed, input, output, signal } from '@angular/core';
import {
  LucideFileCode2,
  LucideFilePlus2,
  LucideFolder,
  LucideFolderPlus,
  LucidePencil,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { UiButtonComponent } from '../../../../shared/components/ui-button/ui-button';
import { UiFormFieldComponent } from '../../../../shared/components/ui-form-field/ui-form-field';
import { UiModalComponent } from '../../../../shared/components/ui-modal/ui-modal';
import { UiSearchInputComponent } from '../../../../shared/components/ui-search-input/ui-search-input';
import { UiSplitPaneComponent } from '../../../../shared/components/ui-split-pane/ui-split-pane';
import { UiTooltipComponent } from '../../../../shared/components/ui-tooltip/ui-tooltip';
import { EditorComment } from '../../models/editor-comment.interface';
import { ProjectFileTree, ProjectFileType } from '../../models/project-file.interface';
import { EditorSidebarOption } from '../../models/editor-sidebar-option.type';
import { EditorCommentsViewComponent } from '../editor-comments-view/editor-comments-view';

type SearchOption = 'caseSensitive' | 'regularExpression' | 'wholeWord';
type ActiveModal = 'file' | 'folder' | null;
type FlatFileEntry = ProjectFileTree & { depth: number };

@Component({
  selector: 'app-editor-side-panel',
  standalone: true,
  imports: [
    LucideFileCode2, LucideFilePlus2, LucideFolder, LucideFolderPlus, LucidePencil, LucideTrash2, LucideX,
    UiButtonComponent, UiFormFieldComponent, UiModalComponent, UiSearchInputComponent, UiSplitPaneComponent,
    UiTooltipComponent, EditorCommentsViewComponent,
  ],
  templateUrl: './editor-side-panel.html',
  styleUrl: './editor-side-panel.css',
})
export class EditorSidePanelComponent {
  readonly view = input<EditorSidebarOption>('files');
  readonly files = input<ProjectFileTree[]>([]);
  readonly activeFileId = input<string | null>(null);
  readonly canEdit = input(false);
  readonly comments = input<EditorComment[]>([]);
  readonly commentFocusRequest = input(0);
  readonly closed = output<void>();
  readonly fileSelected = output<string>();
  readonly createRequested = output<{ parentId: string | null; name: string; type: ProjectFileType }>();
  readonly renameRequested = output<{ id: string; name: string }>();
  readonly deleteRequested = output<string>();
  readonly commentAdded = output<string>();
  readonly searchQuery = signal('');
  readonly activeModal = signal<ActiveModal>(null);
  readonly fileName = signal('main.md');
  readonly folderName = signal('');
  readonly selectedFolderId = signal<string | null>(null);
  readonly activeSearchOptions = signal<Record<SearchOption, boolean>>({ caseSensitive: false, regularExpression: false, wholeWord: false });
  readonly flatEntries = computed<FlatFileEntry[]>(() => {
    const files = this.files();
    const ids = new Set(files.map((file) => file.id));
    const children = new Map<string | null, ProjectFileTree[]>();
    for (const file of files) {
      const parentId = file.parentId && ids.has(file.parentId) ? file.parentId : null;
      children.set(parentId, [...(children.get(parentId) ?? []), file]);
    }
    const entries: FlatFileEntry[] = [];
    const append = (parentId: string | null, depth: number): void => {
      for (const file of children.get(parentId) ?? []) {
        entries.push({ ...file, depth });
        append(file.id, depth + 1);
      }
    };
    append(null, 0);
    return entries;
  });

  toggleSearchOption(option: SearchOption): void {
    this.activeSearchOptions.update((options) => ({ ...options, [option]: !options[option] }));
  }

  openFileDialog(): void { this.fileName.set('main.md'); this.activeModal.set('file'); }
  openFolderDialog(): void { this.folderName.set(''); this.activeModal.set('folder'); }
  closeModal(): void { this.activeModal.set(null); }
  updateModalVisibility(isVisible: boolean, modal: ActiveModal): void {
    if (!isVisible && this.activeModal() === modal) this.closeModal();
  }

  createFile(): void {
    const name = this.fileName();
    if (stringIsWhitespace(name)) return;
    this.createRequested.emit({ parentId: this.selectedFolderId(), name, type: 'FILE' });
    this.closeModal();
  }

  createFolder(): void {
    const name = this.folderName();
    if (stringIsWhitespace(name)) return;
    this.createRequested.emit({ parentId: this.selectedFolderId(), name, type: 'FOLDER' });
    this.closeModal();
  }

  selectEntry(entry: FlatFileEntry): void {
    if (entry.type === 'FOLDER') this.selectedFolderId.set(entry.id);
    else this.fileSelected.emit(entry.id);
  }

  rename(entry: FlatFileEntry): void {
    const name = window.prompt(`Nuevo nombre para ${entry.name}`, entry.name);
    if (name !== null && !stringIsWhitespace(name)) this.renameRequested.emit({ id: entry.id, name });
  }

  delete(entry: FlatFileEntry): void {
    if (window.confirm(`¿Eliminar ${entry.name}?`)) this.deleteRequested.emit(entry.id);
  }
}

function stringIsWhitespace(value: string): boolean { return value.trim().length === 0; }
