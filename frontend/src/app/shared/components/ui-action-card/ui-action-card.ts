import { Component, input, output } from '@angular/core';

export type UiActionCardTone = 'primary' | 'info' | 'warning';

@Component({
  selector: 'app-ui-action-card',
  standalone: true,
  templateUrl: './ui-action-card.html',
  styleUrl: './ui-action-card.css',
})
export class UiActionCardComponent {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly tone = input<UiActionCardTone>('primary');
  readonly pressed = output<void>();
}
