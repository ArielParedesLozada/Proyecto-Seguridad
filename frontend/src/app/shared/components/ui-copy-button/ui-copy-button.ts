import { Component, input, output } from '@angular/core';
@Component({
  selector: 'app-ui-copy-button',
  standalone: true,
  templateUrl: './ui-copy-button.html',
  styleUrl: './ui-copy-button.css',
})
export class UiCopyButtonComponent {
  readonly text = input.required<string>();
  readonly copied = output<void>();
  protected async copy() {
    await navigator.clipboard.writeText(this.text());
    this.copied.emit();
  }
}
