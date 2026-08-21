import { Component, input, output } from '@angular/core';
@Component({
  selector: 'app-ui-icon-button',
  standalone: true,
  templateUrl: './ui-icon-button.html',
  styleUrl: './ui-icon-button.css',
})
export class UiIconButtonComponent {
  readonly label = input.required<string>();
  readonly icon = input('•');
  readonly disabled = input(false);
  readonly pressed = output<void>();
}
