import { Component, input } from '@angular/core';

@Component({
  selector: 'app-auth-illustration',
  standalone: true,
  templateUrl: './auth-illustration.html',
  styleUrl: './auth-illustration.css',
})
export class AuthIllustrationComponent {
  readonly src = input.required<string>();
  readonly alt = input.required<string>();
}
