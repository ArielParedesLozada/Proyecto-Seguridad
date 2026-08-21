import { Component, input, output, signal } from '@angular/core';
import { UiButtonComponent } from '../ui-button/ui-button';

export type UiSplitButtonOption = { id: string; label: string; danger?: boolean };

@Component({
  selector: 'app-ui-split-button',
  standalone: true,
  imports: [UiButtonComponent],
  templateUrl: './ui-split-button.html',
  styleUrl: './ui-split-button.css',
})
export class UiSplitButtonComponent {
  readonly label = input.required<string>();
  readonly options = input<UiSplitButtonOption[]>([]);
  readonly disabled = input(false);
  readonly primaryAction = output<void>();
  readonly optionSelected = output<string>();
  protected readonly open = signal(false);

  protected select(id: string): void {
    this.optionSelected.emit(id);
    this.open.set(false);
  }
}
