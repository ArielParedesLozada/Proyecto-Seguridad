import { Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';

@Component({ selector: 'app-ui-button', standalone: true, imports: [Button], templateUrl: './ui-button.html' })
export class UiButtonComponent {
  readonly label = input.required<string>();
  readonly severity = input<any>('primary');
  readonly outlined = input(false);
  readonly disabled = input(false);
  readonly pressed = output<void>();
}
