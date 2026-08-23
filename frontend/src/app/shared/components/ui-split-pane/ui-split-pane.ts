import { Component, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';

type SplitOrientation = 'horizontal' | 'vertical';
@Component({
  selector: 'app-ui-split-pane',
  standalone: true,
  templateUrl: './ui-split-pane.html',
  styleUrl: './ui-split-pane.css',
})
export class UiSplitPaneComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private dragState: { startCoordinate: number; startSize: number; containerSize: number } | null = null;

  readonly firstSize = input('30%');
  readonly collapsed = input(false);
  readonly firstScrollable = input(true);
  readonly orientation = input<SplitOrientation>('horizontal');
  readonly resizable = input(false);
  readonly collapsible = input(false);
  readonly minFirst = input('12rem');
  readonly maxFirst = input('32rem');
  readonly minSecond = input('12rem');
  readonly collapseToggled = output<void>();
  readonly currentFirstSize = signal<string | null>(null);

  startResize(event: PointerEvent): void {
    if (!this.resizable()) return;

    const split = this.elementRef.nativeElement.querySelector('.split') as HTMLElement | null;
    if (!split) return;

    const rect = split.getBoundingClientRect();
    const isVertical = this.orientation() === 'vertical';
    const containerSize = isVertical ? rect.height : rect.width;

    this.dragState = {
      startCoordinate: isVertical ? event.clientY : event.clientX,
      startSize: this.toPixels(this.currentFirstSize() ?? this.firstSize(), containerSize),
      containerSize,
    };
    event.preventDefault();
  }

  @HostListener('document:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (!this.dragState) return;

    const isVertical = this.orientation() === 'vertical';
    const coordinate = isVertical ? event.clientY : event.clientX;
    const minSize = this.toPixels(this.minFirst(), this.dragState.containerSize);
    const maxSize = Math.min(
      this.toPixels(this.maxFirst(), this.dragState.containerSize),
      this.dragState.containerSize - this.toPixels(this.minSecond(), this.dragState.containerSize),
    );
    const nextSize = Math.min(
      Math.max(this.dragState.startSize + coordinate - this.dragState.startCoordinate, minSize),
      Math.max(minSize, maxSize),
    );

    this.currentFirstSize.set(`${Math.round(nextSize)}px`);
  }

  @HostListener('document:pointerup')
  onPointerUp(): void {
    this.dragState = null;
  }

  private toPixels(value: string, containerSize: number): number {
    if (value.endsWith('%')) return (Number.parseFloat(value) / 100) * containerSize;
    if (value.endsWith('rem')) return Number.parseFloat(value) * 16;
    return Number.parseFloat(value);
  }
}
