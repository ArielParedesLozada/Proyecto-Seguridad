import { NgTemplateOutlet } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  LucideBold,
  LucideCaseSensitive,
  LucideChevronDown,
  LucideEllipsis,
  LucideGitBranch,
  LucideImage,
  LucideItalic,
  LucideLink2,
  LucideList,
  LucideListOrdered,
  LucideMessageSquarePlus,
  LucideQuote,
  LucideRedo2,
  LucideSearch,
  LucideSigma,
  LucideTable2,
  LucideUndo2,
} from '@lucide/angular';
import { UiTabsComponent, UiTab } from '../../../../shared/components/ui-tabs/ui-tabs';
import { UiTooltipComponent } from '../../../../shared/components/ui-tooltip/ui-tooltip';
import { EditorVisualDocumentComponent } from '../editor-visual-document/editor-visual-document';

type ToolbarMenu = 'heading' | 'math' | 'list' | 'overflow' | null;
type OverflowSubmenu = Exclude<ToolbarMenu, 'overflow' | null>;
type EditorMode = 'code' | 'visual';

@Component({
  selector: 'app-editor-workspace',
  standalone: true,
  imports: [
    LucideBold,
    LucideCaseSensitive,
    LucideChevronDown,
    LucideEllipsis,
    LucideGitBranch,
    LucideImage,
    LucideItalic,
    LucideLink2,
    LucideList,
    LucideListOrdered,
    LucideMessageSquarePlus,
    LucideQuote,
    LucideRedo2,
    LucideSearch,
    LucideSigma,
    LucideTable2,
    LucideUndo2,
    UiTabsComponent,
    UiTooltipComponent,
    EditorVisualDocumentComponent,
    NgTemplateOutlet,
  ],
  templateUrl: './editor-workspace.html',
  styleUrl: './editor-workspace.css',
})
export class EditorWorkspaceComponent implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private resizeObserver: ResizeObserver | null = null;

  @ViewChild('toolbarOverflow') private toolbarOverflow?: ElementRef<HTMLElement>;

  readonly selectedFile = input<string | null>('main.tex');
  readonly activeFileChanged = output<string | null>();
  readonly commentRequested = output<void>();
  readonly tabs = signal<UiTab[]>([{ id: 'main.tex', label: 'main.tex' }]);
  readonly activeFileId = signal<string | null>('main.tex');
  readonly fileModes = signal<Record<string, EditorMode>>({ 'main.tex': 'code' });
  readonly openToolbarMenu = signal<ToolbarMenu>(null);
  readonly openOverflowSubmenu = signal<OverflowSubmenu | null>(null);
  readonly overflowAvailableWidth = signal(0);
  readonly selectedHeading = signal('Texto normal');
  readonly editorScrollTop = signal(0);
  readonly fileContents = signal<Record<string, string>>({
    'main.tex': `\\documentclass{article}
\\usepackage{graphicx}

\\title{Ejemplo}
\\author{CipherTeX}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introducción}
Escribe aquí el contenido de tu documento.

\\end{document}`,
  });
  readonly headingOptions = [
    'Texto normal',
    'Sección',
    'Subsección',
    'Subsubsección',
    'Párrafo',
    'Subpárrafo',
  ];
  readonly mathOptions = ['Matemática en línea', 'Matemática en bloque'];
  readonly listOptions = ['Lista con viñetas', 'Lista numerada'];
  readonly activeContent = computed(() => {
    const activeFile = this.activeFileId();
    return activeFile ? (this.fileContents()[activeFile] ?? this.defaultContent(activeFile)) : '';
  });
  readonly mode = computed<EditorMode>(() => {
    const activeFile = this.activeFileId();
    return activeFile ? (this.fileModes()[activeFile] ?? 'code') : 'code';
  });
  readonly lineNumbers = computed(() =>
    Array.from(
      { length: Math.max(1, this.activeContent().split('\n').length) },
      (_, index) => index + 1,
    ),
  );

  constructor() {
    effect(() => {
      const fileName = this.selectedFile();
      if (fileName) this.openFile(fileName);
    });
  }

  ngAfterViewInit(): void {
    const hostElement = this.elementRef.nativeElement as HTMLElement;
    const toolbar = hostElement.querySelector('.editor-toolbar') as HTMLElement | null;
    const overflow = this.toolbarOverflow?.nativeElement;
    if (!toolbar || !overflow) return;

    this.resizeObserver = new ResizeObserver(() => this.updateOverflowAvailableWidth(toolbar, overflow));
    this.resizeObserver.observe(toolbar);
    this.resizeObserver.observe(overflow);
    this.updateOverflowAvailableWidth(toolbar, overflow);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  selectTab(fileName: string): void {
    this.activeFileId.set(fileName);
    this.activeFileChanged.emit(fileName);
  }

  closeTab(fileName: string): void {
    const currentTabs = this.tabs();
    if (currentTabs.length <= 1) return;

    const closingIndex = currentTabs.findIndex((tab) => tab.id === fileName);
    const remainingTabs = currentTabs.filter((tab) => tab.id !== fileName);
    this.tabs.set(remainingTabs);

    if (this.activeFileId() !== fileName) return;

    const nextTab = remainingTabs[Math.min(closingIndex, remainingTabs.length - 1)];
    const nextFile = nextTab?.id ?? null;
    this.activeFileId.set(nextFile);
    this.activeFileChanged.emit(nextFile);
  }

  toggleToolbarMenu(menu: Exclude<ToolbarMenu, null>): void {
    this.openToolbarMenu.update((current) => (current === menu ? null : menu));
    this.openOverflowSubmenu.set(null);
  }

  toggleOverflowSubmenu(menu: OverflowSubmenu): void {
    this.openToolbarMenu.set('overflow');
    this.openOverflowSubmenu.update((current) => (current === menu ? null : menu));
  }

  selectHeading(heading: string): void {
    this.selectedHeading.set(heading);
    this.openToolbarMenu.set(null);
    this.openOverflowSubmenu.set(null);
  }

  selectMath(): void {
    this.openToolbarMenu.set(null);
    this.openOverflowSubmenu.set(null);
  }

  selectList(): void {
    this.openToolbarMenu.set(null);
    this.openOverflowSubmenu.set(null);
  }

  setMode(mode: EditorMode): void {
    const fileName = this.activeFileId();
    if (fileName) this.fileModes.update((modes) => ({ ...modes, [fileName]: mode }));
  }

  updateContent(event: Event): void {
    const fileName = this.activeFileId();
    if (!fileName) return;

    const content = (event.target as HTMLTextAreaElement).value;
    this.fileContents.update((contents) => ({ ...contents, [fileName]: content }));
    this.tabs.update((tabs) =>
      tabs.map((tab) => (tab.id === fileName ? { ...tab, dirty: true } : tab)),
    );
  }

  updateScroll(event: Event): void {
    this.editorScrollTop.set((event.target as HTMLTextAreaElement).scrollTop);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.openToolbarMenu.set(null);
      this.openOverflowSubmenu.set(null);
    }
  }

  private openFile(fileName: string): void {
    if (!this.tabs().some((tab) => tab.id === fileName)) {
      this.tabs.update((tabs) => [...tabs, { id: fileName, label: fileName }]);
    }
    if (!this.fileContents()[fileName]) {
      this.fileContents.update((contents) => ({
        ...contents,
        [fileName]: this.defaultContent(fileName),
      }));
    }
    this.activeFileId.set(fileName);
  }

  private defaultContent(fileName: string): string {
    return `% ${fileName}\n\\begin{document}\n\n\\end{document}`;
  }

  private updateOverflowAvailableWidth(toolbar: HTMLElement, overflow: HTMLElement): void {
    const toolbarBounds = toolbar.getBoundingClientRect();
    const overflowBounds = overflow.getBoundingClientRect();
    this.overflowAvailableWidth.set(Math.max(0, toolbarBounds.right - overflowBounds.left - 7));
  }
}
