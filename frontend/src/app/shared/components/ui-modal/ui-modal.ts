import { Component, input, model } from '@angular/core';
import { Dialog } from 'primeng/dialog';

@Component({
  selector: 'app-ui-modal',
  standalone: true,
  imports: [Dialog],
  templateUrl: './ui-modal.html',
})
export class UiModalComponent {
  readonly title = input.required<string>();
  readonly visible = model(false);
  readonly width = input('30rem');
}
