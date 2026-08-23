import { Component, input, output } from '@angular/core';
import { API_ROUTES } from '../../../../core/constants/api.constants';

@Component({
  selector: 'app-google-auth-button',
  standalone: true,
  templateUrl: './google-auth-button.html',
  styleUrl: './google-auth-button.css',
})
export class GoogleAuthButtonComponent {
  readonly label = input.required<string>();
  readonly selected = output<void>();
  readonly googleLoginUrl = `${API_ROUTES.BASE_URL}${API_ROUTES.auth.login}`;
}
