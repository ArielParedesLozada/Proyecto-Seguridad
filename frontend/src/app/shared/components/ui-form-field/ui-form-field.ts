import { Component, input } from '@angular/core';
@Component({
  selector: 'app-ui-form-field',
  standalone: true,
  templateUrl: './ui-form-field.html',
  styleUrl: './ui-form-field.css',
})
export class UiFormFieldComponent {
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly error = input('');
}
