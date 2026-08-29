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
  LucideChevronUp,
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
  LucideX,
} from '@lucide/angular';
import { UiSearchInputComponent } from '../../../../shared/components/ui-search-input/ui-search-input';
import { UiTabsComponent, UiTab } from '../../../../shared/components/ui-tabs/ui-tabs';
import { UiTooltipComponent } from '../../../../shared/components/ui-tooltip/ui-tooltip';
import { EditorVisualDocumentComponent } from '../editor-visual-document/editor-visual-document';
import { ProjectFile } from '../../models/project-file.interface';
import { KeyboardShortcutService } from '../../../../core/shortcuts/keyboard-shortcut.service';

type ToolbarMenu = 'heading' | 'math' | 'list' | 'overflow' | null;
type OverflowSubmenu = Exclude<ToolbarMenu, 'overflow' | null>;
type EditorMode = 'code' | 'visual';
type DocumentSearchOption = 'caseSensitive' | 'regularExpression' | 'wholeWord';
type TextMatch = { start: number; end: number };

@Component({
  selector: 'app-editor-workspace',
  standalone: true,
  imports: [
    LucideBold,
    LucideCaseSensitive,
    LucideChevronDown,
    LucideChevronUp,
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
    LucideX,
    UiTabsComponent,
    UiSearchInputComponent,
    UiTooltipComponent,
    EditorVisualDocumentComponent,
    NgTemplateOutlet,
  ],
  templateUrl: './editor-workspace.html',
  styleUrl: './editor-workspace.css',
})
export class EditorWorkspaceComponent implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly shortcutService = inject(KeyboardShortcutService);
  private resizeObserver: ResizeObserver | null = null;

  @ViewChild('toolbarOverflow') private toolbarOverflow?: ElementRef<HTMLElement>;
  @ViewChild('codeInput') private codeInput?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('documentSearchInput') private documentSearchInput?: UiSearchInputComponent;

  readonly selectedFile = input<ProjectFile | null>(null);
  readonly canEdit = input(false);
  readonly savedFileId = input<string | null>(null);
  readonly saveVersion = input(0);
  readonly activeFileChanged = output<string | null>();
  readonly contentSaved = output<{ id: string; content: string }>();
  readonly recompileRequested = output<void>();
  readonly commentRequested = output<void>();
  readonly tabs = signal<UiTab[]>([]);
  readonly activeFileId = signal<string | null>(null);
  readonly fileModes = signal<Record<string, EditorMode>>({});
  readonly openToolbarMenu = signal<ToolbarMenu>(null);
  readonly openOverflowSubmenu = signal<OverflowSubmenu | null>(null);
  readonly overflowAvailableWidth = signal(0);
  readonly selectedHeading = signal('Texto normal');
  readonly editorScrollTop = signal(0);
  readonly documentSearchOpen = signal(false);
  readonly documentSearchQuery = signal('');
  readonly documentReplacement = signal('');
  readonly documentSearchIndex = signal(0);
  readonly documentSearchOptions = signal<Record<DocumentSearchOption, boolean>>({
    caseSensitive: false,
    regularExpression: false,
    wholeWord: false,
  });
  readonly fileContents = signal<Record<string, string>>({});
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
    return activeFile ? (this.fileContents()[activeFile] ?? '') : '';
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
  readonly documentMatches = computed(() =>
    this.findMatches(
      this.activeContent(),
      this.documentSearchQuery(),
      this.documentSearchOptions(),
    ),
  );
  readonly activeDocumentMatch = computed(() => {
    const matches = this.documentMatches();
    return matches[this.documentSearchIndex()] ?? null;
  });

  constructor() {
    effect(() => {
      const file = this.selectedFile();
      if (file) this.openFile(file);
    });
    effect(() => {
      const fileId = this.savedFileId();
      if (!this.saveVersion() || !fileId) return;
      this.tabs.update((tabs) => tabs.map((tab) => tab.id === fileId ? { ...tab, dirty: false } : tab));
    });
    effect(() => {
      const matchCount = this.documentMatches().length;
      this.documentSearchIndex.update((index) => (matchCount ? Math.min(index, matchCount - 1) : 0));
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
    this.documentSearchIndex.set(0);
    this.activeFileChanged.emit(fileName);
    if (this.documentSearchOpen()) this.focusDocumentSearchInput();
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
    if (!this.canEdit()) return;
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

  openDocumentSearch(): void {
    this.documentSearchOpen.set(true);
    this.focusDocumentSearchInput();
  }

  toggleDocumentSearch(): void {
    if (this.documentSearchOpen()) {
      this.closeDocumentSearch();
      return;
    }
    this.openDocumentSearch();
  }

  closeDocumentSearch(): void {
    this.documentSearchOpen.set(false);
    this.documentSearchQuery.set('');
    this.documentReplacement.set('');
    this.documentSearchIndex.set(0);
    this.clearTextSelection();
  }

  updateDocumentSearchQuery(query: string): void {
    this.documentSearchQuery.set(query);
    this.documentSearchIndex.set(0);
    queueMicrotask(() => this.focusActiveMatch());
  }

  updateDocumentReplacement(event: Event): void {
    this.documentReplacement.set((event.target as HTMLInputElement).value);
  }

  toggleDocumentSearchOption(option: DocumentSearchOption): void {
    this.documentSearchOptions.update((options) => ({ ...options, [option]: !options[option] }));
    this.documentSearchIndex.set(0);
    queueMicrotask(() => this.focusActiveMatch());
  }

  previousDocumentMatch(): void {
    this.moveDocumentMatch(-1);
  }

  nextDocumentMatch(): void {
    this.moveDocumentMatch(1);
  }

  replaceCurrentDocumentMatch(): void {
    if (!this.canEdit()) return;
    const match = this.activeDocumentMatch();
    const fileName = this.activeFileId();
    if (!match || !fileName) return;

    const content = this.activeContent();
    const replacement = this.documentReplacement();
    this.setActiveFileContent(content.slice(0, match.start) + replacement + content.slice(match.end));
    queueMicrotask(() => this.focusActiveMatch());
  }

  replaceAllDocumentMatches(): void {
    if (!this.canEdit()) return;
    const matches = this.documentMatches();
    if (!matches.length || !this.activeFileId()) return;

    const replacement = this.documentReplacement();
    let content = this.activeContent();
    for (const match of [...matches].reverse()) {
      content = content.slice(0, match.start) + replacement + content.slice(match.end);
    }
    this.setActiveFileContent(content);
    this.documentSearchIndex.set(0);
    queueMicrotask(() => this.focusActiveMatch());
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (this.shortcutService.matches(event, 'SAVE_DOCUMENT')) {
      event.preventDefault();
      const fileId = this.activeFileId();
      if (fileId && this.canEdit()) {
        const content = this.codeInput?.nativeElement.value ?? this.activeContent();
        this.fileContents.update((contents) => ({ ...contents, [fileId]: content }));
        this.contentSaved.emit({ id: fileId, content });
      }
      return;
    }

    if (this.shortcutService.matches(event, 'FIND')) {
      event.preventDefault();
      this.openDocumentSearch();
      return;
    }

    if (this.shortcutService.matches(event, 'RECOMPILE')) {
      event.preventDefault();
      this.recompileRequested.emit();
      return;
    }

    if (!this.documentSearchOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDocumentSearch();
      return;
    }

    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      if (event.shiftKey) this.previousDocumentMatch();
      else this.nextDocumentMatch();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.openToolbarMenu.set(null);
      this.openOverflowSubmenu.set(null);
    }
  }

  private openFile(file: ProjectFile): void {
    if (!this.tabs().some((tab) => tab.id === file.id)) {
      this.tabs.update((tabs) => [...tabs, { id: file.id, label: file.name }]);
    }
    this.fileContents.update((contents) => ({ ...contents, [file.id]: file.content ?? '' }));
    this.activeFileId.set(file.id);
  }

  private moveDocumentMatch(direction: number): void {
    const matches = this.documentMatches();
    if (!matches.length) return;

    this.documentSearchIndex.update((index) => (index + direction + matches.length) % matches.length);
    queueMicrotask(() => this.focusActiveMatch());
  }

  private setActiveFileContent(content: string): void {
    if (!this.canEdit()) return;
    const fileName = this.activeFileId();
    if (!fileName) return;

    this.fileContents.update((contents) => ({ ...contents, [fileName]: content }));
    this.tabs.update((tabs) =>
      tabs.map((tab) => (tab.id === fileName ? { ...tab, dirty: true } : tab)),
    );
  }

  private focusDocumentSearchInput(): void {
    setTimeout(() => this.documentSearchInput?.focus());
  }

  private focusActiveMatch(): void {
    const match = this.activeDocumentMatch();
    const input = this.codeInput?.nativeElement;
    if (!match || !input || this.mode() !== 'code') return;

    const lineNumber = this.activeContent().slice(0, match.start).split('\n').length - 1;
    const lineHeight = Number.parseFloat(getComputedStyle(input).lineHeight) || 20;
    input.scrollTop = Math.max(0, lineNumber * lineHeight - input.clientHeight / 2);
    input.setSelectionRange(match.start, match.end);
  }

  private clearTextSelection(): void {
    const input = this.codeInput?.nativeElement;
    if (!input) return;
    input.setSelectionRange(input.selectionStart, input.selectionStart);
  }

  private findMatches(
    content: string,
    query: string,
    options: Record<DocumentSearchOption, boolean>,
  ): TextMatch[] {
    if (!query) return [];

    const source = options.regularExpression ? query : this.escapeRegularExpression(query);
    const boundedSource = options.wholeWord ? `\\b(?:${source})\\b` : source;
    const flags = `g${options.caseSensitive ? '' : 'i'}`;

    try {
      const expression = new RegExp(boundedSource, flags);
      const matches: TextMatch[] = [];
      for (const match of content.matchAll(expression)) {
        if (!match[0].length) continue;
        const start = match.index ?? 0;
        matches.push({ start, end: start + match[0].length });
      }
      return matches;
    } catch {
      return [];
    }
  }

  private escapeRegularExpression(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private updateOverflowAvailableWidth(toolbar: HTMLElement, overflow: HTMLElement): void {
    const toolbarBounds = toolbar.getBoundingClientRect();
    const overflowBounds = overflow.getBoundingClientRect();
    this.overflowAvailableWidth.set(Math.max(0, toolbarBounds.right - overflowBounds.left - 7));
  }
}
