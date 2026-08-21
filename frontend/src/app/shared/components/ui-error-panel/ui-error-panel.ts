import { Component, input, output } from '@angular/core';
export type UiCompilationError = {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
};
@Component({
  selector: 'app-ui-error-panel',
  standalone: true,
  templateUrl: './ui-error-panel.html',
  styleUrl: './ui-error-panel.css',
})
export class UiErrorPanelComponent {
  readonly errors = input<UiCompilationError[]>([]);
  readonly selected = output<UiCompilationError>();
}
