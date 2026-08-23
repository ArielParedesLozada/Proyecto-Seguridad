import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, HostListener, inject, input, OnDestroy, ViewEncapsulation } from '@angular/core';
@Component({
  selector: 'app-ui-tooltip',
  standalone: true,
  templateUrl: './ui-tooltip.html',
  styleUrl: './ui-tooltip.css',
  encapsulation: ViewEncapsulation.None,
})
export class UiTooltipComponent implements OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly document = inject(DOCUMENT);
  private tooltipElement: HTMLElement | null = null;

  readonly text = input.required<string>();
  readonly position = input<'top' | 'right'>('top');
  readonly disabled = input(false);
  readonly showOnFocus = input(true);

  show(): void {
    if (this.disabled()) return;

    this.removeTooltip();
    this.tooltipElement = this.document.createElement('small');
    this.tooltipElement.className = `ui-tooltip-overlay ui-tooltip-${this.position()}`;
    this.tooltipElement.textContent = this.text();
    this.document.body.append(this.tooltipElement);
    this.updatePosition();
  }

  hide(): void {
    this.removeTooltip();
  }

  showFromFocus(): void {
    if (this.showOnFocus()) this.show();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  updatePosition(): void {
    if (!this.tooltipElement) return;

    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    if (this.position() === 'right') {
      this.tooltipElement.style.left = `${rect.right + 9}px`;
      this.tooltipElement.style.top = `${rect.top + rect.height / 2}px`;
      return;
    }

    this.tooltipElement.style.left = `${rect.left + rect.width / 2}px`;
    this.tooltipElement.style.top = `${rect.top - 7}px`;
  }

  ngOnDestroy(): void {
    this.removeTooltip();
  }

  private removeTooltip(): void {
    this.tooltipElement?.remove();
    this.tooltipElement = null;
  }
}
