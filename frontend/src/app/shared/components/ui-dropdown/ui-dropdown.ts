import { Component, input, output } from '@angular/core';
export type UiOption = { label: string; value: string };
@Component({
  selector: 'app-ui-dropdown',
  standalone: true,
  templateUrl: './ui-dropdown.html',
  styleUrl: './ui-dropdown.css',
})
export class UiDropdownComponent {
  readonly options = input<UiOption[]>([]);
  readonly value = input('');
  readonly changed = output<string>();
}
