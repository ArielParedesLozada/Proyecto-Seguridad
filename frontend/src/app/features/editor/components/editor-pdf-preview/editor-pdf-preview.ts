import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { LucideContrast, LucideDownload } from '@lucide/angular';
import { UiTooltipComponent } from '../../../../shared/components/ui-tooltip/ui-tooltip';

export type PdfPreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-editor-pdf-preview',
  standalone: true,
  imports: [LucideContrast, LucideDownload, UiTooltipComponent],
  templateUrl: './editor-pdf-preview.html',
  styleUrl: './editor-pdf-preview.css',
})
export class EditorPdfPreviewComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly pdfUrl = input<string | null>(null);
  readonly status = input<PdfPreviewStatus>('idle');
  readonly errorMessage = input<string | null>(null);
  readonly recompileRequested = output<void>();
  readonly inverted = signal(false);
  readonly safePdfUrl = computed(() => {
    const url = this.pdfUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  recompile(): void {
    if (this.status() !== 'loading') this.recompileRequested.emit();
  }

  toggleInverted(): void {
    this.inverted.update((value) => !value);
  }

  downloadPdf(): void {
    const url = this.pdfUrl();
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = 'document.pdf';
    link.click();
  }
}
