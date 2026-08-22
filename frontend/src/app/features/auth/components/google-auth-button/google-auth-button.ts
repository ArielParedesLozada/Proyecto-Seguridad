import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-google-auth-button',
  standalone: true,
  templateUrl: './google-auth-button.html',
  styleUrl: './google-auth-button.css',
})
export class GoogleAuthButtonComponent {
  readonly label = input.required<string>();
  readonly selected = output<void>();
}
