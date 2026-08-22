import { Component, input, output, signal } from '@angular/core';
import {
  LucideFileCode2,
  LucideFilePlus2,
  LucideFolder,
  LucideFolderPlus,
  LucideUpload,
  LucideX,
} from '@lucide/angular';
import { UiButtonComponent } from '../../../../shared/components/ui-button/ui-button';
import { UiFileUploadComponent } from '../../../../shared/components/ui-file-upload/ui-file-upload';
import { UiFormFieldComponent } from '../../../../shared/components/ui-form-field/ui-form-field';
import { UiModalComponent } from '../../../../shared/components/ui-modal/ui-modal';
import { UiSearchInputComponent } from '../../../../shared/components/ui-search-input/ui-search-input';
import { UiSplitPaneComponent } from '../../../../shared/components/ui-split-pane/ui-split-pane';
import { UiTooltipComponent } from '../../../../shared/components/ui-tooltip/ui-tooltip';
import { EditorSidebarOption } from '../../models/editor-sidebar-option.type';

type SearchOption = 'caseSensitive' | 'regularExpression' | 'wholeWord';
type FileDialogMode = 'new' | 'upload';
type ActiveModal = 'file' | 'folder' | null;
type ProjectEntry = { name: string; type: 'file' | 'folder' };

@Component({
  selector: 'app-editor-side-panel',
  standalone: true,
  imports: [
    LucideFileCode2,
    LucideFilePlus2,
    LucideFolder,
    LucideFolderPlus,
    LucideUpload,
    LucideX,
    UiButtonComponent,
    UiFileUploadComponent,
    UiFormFieldComponent,
    UiModalComponent,
    UiSearchInputComponent,
    UiSplitPaneComponent,
    UiTooltipComponent,
  ],
  templateUrl: './editor-side-panel.html',
  styleUrl: './editor-side-panel.css',
})
export class EditorSidePanelComponent {
  readonly view = input<EditorSidebarOption>('files');
  readonly closed = output<void>();
  readonly searchQuery = signal('');
  readonly activeModal = signal<ActiveModal>(null);
  readonly fileDialogMode = signal<FileDialogMode>('new');
  readonly fileName = signal('nombre.tex');
  readonly folderName = signal('');
  readonly selectedUploadName = signal('');
  readonly projectEntries = signal<ProjectEntry[]>([{ name: 'main.tex', type: 'file' }]);
  readonly activeSearchOptions = signal<Record<SearchOption, boolean>>({
    caseSensitive: false,
    regularExpression: false,
    wholeWord: false,
  });

  toggleSearchOption(option: SearchOption): void {
    this.activeSearchOptions.update((options) => ({ ...options, [option]: !options[option] }));
  }

  openFileDialog(mode: FileDialogMode): void {
    this.fileDialogMode.set(mode);
    if (mode === 'new') this.fileName.set('nombre.tex');
    this.selectedUploadName.set('');
    this.activeModal.set('file');
  }

  openFolderDialog(): void {
    this.folderName.set('');
    this.activeModal.set('folder');
  }

  closeModal(): void {
    this.activeModal.set(null);
  }

  updateFileModalVisibility(isVisible: boolean): void {
    if (!isVisible && this.activeModal() === 'file') this.closeModal();
  }

  updateFolderModalVisibility(isVisible: boolean): void {
    if (!isVisible && this.activeModal() === 'folder') this.closeModal();
  }

  createFile(): void {
    const name = this.fileName().trim();
    if (!name) return;

    this.projectEntries.update((entries) => [...entries, { name, type: 'file' }]);
    this.closeModal();
  }

  createFolder(): void {
    const name = this.folderName().trim();
    if (!name) return;

    this.projectEntries.update((entries) => [...entries, { name, type: 'folder' }]);
    this.closeModal();
  }

  selectUpload(file: File | undefined): void {
    this.selectedUploadName.set(file?.name ?? '');
  }
}
