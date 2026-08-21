import { Component, input, output } from '@angular/core';
import { UiButtonComponent } from '../ui-button/ui-button';

@Component({
  selector: 'app-ui-modal-actions',
  standalone: true,
  imports: [UiButtonComponent],
  templateUrl: './ui-modal-actions.html',
  styleUrl: './ui-modal-actions.css',
})
export class UiModalActionsComponent {
  readonly primaryLabel = input.required<string>();
  readonly cancelLabel = input('Cancelar');
  readonly primaryDisabled = input(false);
  readonly cancelled = output<void>();
  readonly confirmed = output<void>();
}
