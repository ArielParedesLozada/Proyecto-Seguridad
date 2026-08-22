import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GoogleAuthButtonComponent } from '../../components/google-auth-button/google-auth-button';
import { AuthIllustrationComponent } from '../../components/auth-illustration/auth-illustration';
import { UiBrandLogoComponent } from '../../../../shared/components/ui-brand-logo/ui-brand-logo';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, GoogleAuthButtonComponent, AuthIllustrationComponent, UiBrandLogoComponent],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class RegisterComponent {}
