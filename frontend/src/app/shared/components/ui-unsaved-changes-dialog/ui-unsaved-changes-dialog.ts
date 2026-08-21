import { Component, model, output } from '@angular/core';
import { UiButtonComponent } from '../ui-button/ui-button';
import { UiModalComponent } from '../ui-modal/ui-modal';
@Component({
  selector: 'app-ui-unsaved-changes-dialog',
  standalone: true,
  imports: [UiButtonComponent, UiModalComponent],
  templateUrl: './ui-unsaved-changes-dialog.html',
  styleUrl: './ui-unsaved-changes-dialog.css',
})
export class UiUnsavedChangesDialogComponent {
  readonly visible = model(false);
  readonly save = output<void>();
  readonly discard = output<void>();
  readonly cancel = output<void>();
}
