import { Component, input } from '@angular/core';
@Component({
  selector: 'app-ui-log-viewer',
  standalone: true,
  templateUrl: './ui-log-viewer.html',
  styleUrl: './ui-log-viewer.css',
})
export class UiLogViewerComponent {
  readonly content = input('');
  readonly title = input('Registro de compilación');
}
