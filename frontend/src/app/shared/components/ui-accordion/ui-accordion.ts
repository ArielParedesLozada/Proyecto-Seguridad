import { Component, input, signal } from '@angular/core';
@Component({
  selector: 'app-ui-accordion',
  standalone: true,
  templateUrl: './ui-accordion.html',
  styleUrl: './ui-accordion.css',
})
export class UiAccordionComponent {
  readonly title = input.required<string>();
  readonly open = signal(true);
}
