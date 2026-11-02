import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EditorPdfPreviewComponent } from '../../features/editor/components/editor-pdf-preview/editor-pdf-preview';
import { EditorSidePanelComponent } from '../../features/editor/components/editor-side-panel/editor-side-panel';
import { EditorSidebarComponent } from '../../features/editor/components/editor-sidebar/editor-sidebar';
import { EditorToolbarComponent } from '../../features/editor/components/editor-toolbar/editor-toolbar';
import { EditorWorkspaceComponent } from '../../features/editor/components/editor-workspace/editor-workspace';
import { ProjectFileService } from '../../features/editor/data-access/project-file.service';
import { ProjectCompilationService } from '../../features/editor/data-access/project-compilation.service';
import { PdfPreviewStatus } from '../../features/editor/components/editor-pdf-preview/editor-pdf-preview';
import { CreateProjectFileRequest, ProjectFile, ProjectFileTree } from '../../features/editor/models/project-file.interface';
import { EditorComment } from '../../features/editor/models/editor-comment.interface';
import { EditorSidebarOption } from '../../features/editor/models/editor-sidebar-option.type';
import { ProjectService } from '../../features/projects/data-access/project.service';
import { ProjectResponse } from '../../features/projects/models/project.interface';
import { UiSplitPaneComponent } from '../../shared/components/ui-split-pane/ui-split-pane';

@Component({
  selector: 'app-editor-layout',
  standalone: true,
  imports: [EditorSidebarComponent, EditorSidePanelComponent, EditorToolbarComponent, EditorWorkspaceComponent, EditorPdfPreviewComponent, UiSplitPaneComponent],
  templateUrl: './editor-layout.html',
  styleUrl: './editor-layout.css',
})
export class EditorLayoutComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly projectService = inject(ProjectService);
  private readonly projectFileService = inject(ProjectFileService);
  private readonly projectCompilationService = inject(ProjectCompilationService);
  private readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';

  readonly activeSidebarOption = signal<EditorSidebarOption>('files');
  readonly isSidePanelVisible = signal(true);
  readonly activeEditorFile = signal<ProjectFile | null>(null);
  readonly projectFiles = signal<ProjectFileTree[]>([]);
  readonly project = signal<ProjectResponse | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly pdfUrl = signal<string | null>(null);
  readonly pdfStatus = signal<PdfPreviewStatus>('idle');
  readonly pdfError = signal<string | null>(null);
  readonly savedFileId = signal<string | null>(null);
  readonly saveVersion = signal(0);
  readonly comments = signal<EditorComment[]>([]);
  readonly commentFocusRequest = signal(0);
  readonly canEdit = computed(() => {
    const project = this.project();
    return !!project && !project.isArchived && (project.role === 'OWNER' || project.role === 'EDITOR');
  });

  constructor() { void this.loadProject(); }

  ngOnDestroy(): void {
    const url = this.pdfUrl();
    if (url) URL.revokeObjectURL(url);
  }

  toggleSidePanelFromSidebar(option: EditorSidebarOption): void {
    if (this.activeSidebarOption() === option) {
      this.isSidePanelVisible.update((isVisible) => !isVisible);
      return;
    }
    this.activeSidebarOption.set(option);
    this.isSidePanelVisible.set(true);
  }

  toggleSidePanel(): void { this.isSidePanelVisible.update((isVisible) => !isVisible); }

  async selectEditorFile(fileId: string): Promise<void> {
    try { this.activeEditorFile.set(await this.projectFileService.getFile(this.projectId, fileId)); }
    catch (error) { this.setError(error, 'No fue posible abrir el archivo.'); }
  }

  async createFile(request: CreateProjectFileRequest): Promise<void> {
    try {
      const file = await this.projectFileService.createFile(this.projectId, request);
      this.projectFiles.update((files) => [...files, file]);
      if (file.type === 'FILE') this.activeEditorFile.set(file);
    } catch (error) { this.setError(error, 'No fue posible crear el elemento.'); }
  }

  async renameFile(change: { id: string; name: string }): Promise<void> {
    try {
      const file = await this.projectFileService.renameFile(this.projectId, change.id, change.name);
      this.projectFiles.update((files) => files.map((item) => item.id === file.id ? file : item));
      this.activeEditorFile.update((active) => active?.id === file.id ? { ...active, ...file } : active);
    } catch (error) { this.setError(error, 'No fue posible renombrar el elemento.'); }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.projectFileService.deleteFile(this.projectId, fileId);
      const deletedIds = new Set<string>([fileId]);
      let found = true;
      while (found) {
        found = false;
        for (const file of this.projectFiles()) {
          if (file.parentId && deletedIds.has(file.parentId) && !deletedIds.has(file.id)) {
            deletedIds.add(file.id);
            found = true;
          }
        }
      }
      this.projectFiles.update((files) => files.filter((file) => !deletedIds.has(file.id)));
      if (this.activeEditorFile() && deletedIds.has(this.activeEditorFile()!.id)) this.activeEditorFile.set(null);
    } catch (error) { this.setError(error, 'No fue posible eliminar el elemento.'); }
  }

  async saveContent(change: { id: string; content: string }): Promise<void> {
    try {
      const savedFile = await this.projectFileService.saveContent(this.projectId, change.id, change.content);
      this.activeEditorFile.set(savedFile);
      this.savedFileId.set(savedFile.id);
      this.saveVersion.update((version) => version + 1);
      if (savedFile.name === 'main.md' && savedFile.parentId === null) await this.compileProject();
    }
    catch (error) { this.setError(error, 'No fue posible guardar el contenido.'); }
  }

  async compileProject(): Promise<void> {
    this.pdfStatus.set('loading');
    this.pdfError.set(null);
    try {
      const pdf = await this.projectCompilationService.compile(this.projectId);
      const nextUrl = URL.createObjectURL(pdf);
      const previousUrl = this.pdfUrl();
      this.pdfUrl.set(nextUrl);
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      this.pdfStatus.set('ready');
    } catch (error) {
      this.pdfStatus.set('error');
      this.pdfError.set(error instanceof Error ? error.message : 'No fue posible generar el PDF.');
    }
  }

  openCommentsPanel(): void {
    this.activeSidebarOption.set('comments');
    this.isSidePanelVisible.set(true);
    this.commentFocusRequest.update((request) => request + 1);
  }

  addComment(content: string): void {
    this.comments.update((comments) => [...comments, {
      id: `comment-${Date.now()}`, author: 'Diego', content,
      createdAt: new Intl.DateTimeFormat('es-EC', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
    }]);
  }

  private async loadProject(): Promise<void> {
    try {
      const [project, files] = await Promise.all([this.projectService.getProject(this.projectId), this.projectFileService.getFiles(this.projectId)]);
      this.project.set(project);
      this.projectFiles.set(files);
      const initialFile = files.find((file) => file.name === 'main.md' && file.type === 'FILE') ?? files.find((file) => file.type === 'FILE');
      const mainFile = files.find((file) => file.name === 'main.md' && file.parentId === null && file.type === 'FILE');
      if (initialFile) await this.selectEditorFile(initialFile.id);
      if (mainFile) await this.compileProject();
      else {
        this.pdfStatus.set('error');
        this.pdfError.set('El proyecto no tiene un archivo principal main.md.');
      }
    } catch (error) { this.setError(error, 'No fue posible cargar el proyecto.'); }
  }

  private setError(error: unknown, fallback: string): void {
    this.loadError.set(error instanceof Error ? error.message : fallback);
  }
}
