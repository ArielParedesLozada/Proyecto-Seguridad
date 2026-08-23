import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  LucideCheck,
  LucideChevronDown,
  LucideChevronLeft,
  LucideChevronRight,
  LucideContrast,
  LucideDownload,
  LucideMinus,
  LucidePlus,
} from '@lucide/angular';
import { UiTooltipComponent } from '../../../../shared/components/ui-tooltip/ui-tooltip';

type CompileMode = 'normal' | 'fast';
type SyntaxCheck = 'enabled' | 'disabled';
type ErrorHandling = 'stop' | 'continue';
type ZoomMode = 'manual' | 'fit-width' | 'fit-height';

@Component({
  selector: 'app-editor-pdf-preview',
  standalone: true,
  imports: [
    LucideCheck,
    LucideChevronDown,
    LucideChevronLeft,
    LucideChevronRight,
    LucideContrast,
    LucideDownload,
    LucideMinus,
    LucidePlus,
    UiTooltipComponent,
  ],
  templateUrl: './editor-pdf-preview.html',
  styleUrl: './editor-pdf-preview.css',
})
export class EditorPdfPreviewComponent implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private resizeObserver: ResizeObserver | null = null;
  private scrollFrame: number | null = null;

  @ViewChild('pdfStage') private pdfStage?: ElementRef<HTMLElement>;
  @ViewChildren('pdfPage') private pdfPages?: QueryList<ElementRef<HTMLElement>>;

  readonly pages = [1, 2];
  readonly totalPages = this.pages.length;
  readonly currentPage = signal(1);
  readonly zoom = signal(100);
  readonly zoomMode = signal<ZoomMode>('manual');
  readonly inverted = signal(false);
  readonly recompileMenuOpen = signal(false);
  readonly zoomMenuOpen = signal(false);
  readonly automaticCompilation = signal(true);
  readonly compileMode = signal<CompileMode>('normal');
  readonly syntaxCheck = signal<SyntaxCheck>('enabled');
  readonly errorHandling = signal<ErrorHandling>('stop');
  readonly presentationMode = signal(false);
  readonly zoomLabel = computed(() => `${this.zoom()}%`);

  ngAfterViewInit(): void {
    const stage = this.pdfStage?.nativeElement;
    if (!stage) return;

    this.resizeObserver = new ResizeObserver(() => this.recalculateFitZoom());
    this.resizeObserver.observe(stage);
    requestAnimationFrame(() => this.recalculateFitZoom());
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
  }

  toggleRecompileMenu(): void {
    this.recompileMenuOpen.update((open) => !open);
    this.zoomMenuOpen.set(false);
  }

  toggleZoomMenu(): void {
    this.zoomMenuOpen.update((open) => !open);
    this.recompileMenuOpen.set(false);
  }

  recompile(): void {
    this.recompileMenuOpen.set(false);
  }

  downloadPdf(): void {
    // Placeholder for the generated PDF download.
  }

  toggleInverted(): void {
    this.inverted.update((inverted) => !inverted);
  }

  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  zoomOut(): void {
    this.setZoom(this.zoom() - 10);
  }

  zoomIn(): void {
    this.setZoom(this.zoom() + 10);
  }

  setZoom(value: number): void {
    this.zoomMode.set('manual');
    this.setCalculatedZoom(value);
  }

  updateZoom(event: Event): void {
    const value = Number.parseInt((event.target as HTMLInputElement).value.replace('%', ''), 10);
    if (!Number.isNaN(value)) this.setZoom(value);
  }

  fitToWidth(): void {
    this.zoomMode.set('fit-width');
    this.recalculateFitZoom();
  }

  fitToHeight(): void {
    this.zoomMode.set('fit-height');
    this.recalculateFitZoom();
  }

  togglePresentationMode(): void {
    this.presentationMode.update((enabled) => !enabled);
    this.zoomMenuOpen.set(false);
  }

  exitPresentationMode(): void {
    this.presentationMode.set(false);
  }

  onStageScroll(): void {
    if (this.scrollFrame !== null) return;

    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = null;
      const stage = this.pdfStage?.nativeElement;
      const pages = this.pdfPages?.toArray() ?? [];
      if (!stage || !pages.length) return;

      const stageTop = stage.getBoundingClientRect().top;
      const closestPage = pages.reduce((closest, page) => {
        const currentDistance = Math.abs(page.nativeElement.getBoundingClientRect().top - stageTop);
        const closestDistance = Math.abs(closest.nativeElement.getBoundingClientRect().top - stageTop);
        return currentDistance < closestDistance ? page : closest;
      });
      const pageIndex = pages.indexOf(closestPage);
      this.currentPage.set(pageIndex + 1);
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.target instanceof HTMLInputElement) return;

    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomOut();
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.recompileMenuOpen.set(false);
      this.zoomMenuOpen.set(false);
    }
  }

  private goToPage(page: number): void {
    const nextPage = Math.min(this.totalPages, Math.max(1, page));
    this.currentPage.set(nextPage);
    setTimeout(() => this.scrollToPage(nextPage));
  }

  private scrollToPage(page: number): void {
    const stage = this.pdfStage?.nativeElement;
    const target = this.pdfPages?.get(page - 1)?.nativeElement;
    if (!stage || !target) return;

    stage.scrollTo({ top: target.offsetTop - stage.offsetTop, behavior: 'smooth' });
  }

  private recalculateFitZoom(): void {
    const stage = this.pdfStage?.nativeElement;
    if (!stage || this.zoomMode() === 'manual') return;

    const stagePadding = 48;
    const basePageWidth = 592;
    const basePageHeight = 768;
    const availableSize = this.zoomMode() === 'fit-width'
      ? stage.clientWidth - stagePadding
      : stage.clientHeight - stagePadding;
    const baseSize = this.zoomMode() === 'fit-width' ? basePageWidth : basePageHeight;
    this.setCalculatedZoom((availableSize / baseSize) * 100);
  }

  private setCalculatedZoom(value: number): void {
    this.zoom.set(Math.min(400, Math.max(25, Math.round(value))));
  }
}
