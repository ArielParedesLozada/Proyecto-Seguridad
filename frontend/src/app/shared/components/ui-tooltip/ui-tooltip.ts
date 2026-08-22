import { Component, input } from '@angular/core';
@Component({
  selector: 'app-ui-tooltip',
  standalone: true,
  templateUrl: './ui-tooltip.html',
  styleUrl: './ui-tooltip.css',
})
export class UiTooltipComponent {
  readonly text = input.required<string>();
  readonly position = input<'top' | 'right'>('top');
  readonly disabled = input(false);
}
