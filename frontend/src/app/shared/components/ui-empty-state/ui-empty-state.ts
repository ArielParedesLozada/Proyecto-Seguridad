import { Component, input } from '@angular/core';

@Component({
  selector: 'app-ui-empty-state',
  standalone: true,
  templateUrl: './ui-empty-state.html',
  styleUrl: './ui-empty-state.css',
})
export class UiEmptyStateComponent {
  readonly icon = input('□');
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
