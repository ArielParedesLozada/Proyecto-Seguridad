import { Component, input, model, output } from '@angular/core';
import { UiButtonComponent } from '../ui-button/ui-button';
import { UiModalComponent } from '../ui-modal/ui-modal';
@Component({
  selector: 'app-ui-confirm-dialog',
  standalone: true,
  imports: [UiButtonComponent, UiModalComponent],
  templateUrl: './ui-confirm-dialog.html',
  styleUrl: './ui-confirm-dialog.css',
})
export class UiConfirmDialogComponent {
  readonly visible = model(false);
  readonly title = input('Confirmar acción');
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirmar');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
