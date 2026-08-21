import { Component, input } from '@angular/core';

@Component({
  selector: 'app-ui-status-badge',
  standalone: true,
  templateUrl: './ui-status-badge.html',
  styleUrl: './ui-status-badge.css',
})
export class UiStatusBadgeComponent {
  readonly label = input.required<string>();
  readonly tone = input<'success' | 'warning' | 'danger' | 'neutral'>('neutral');
}
