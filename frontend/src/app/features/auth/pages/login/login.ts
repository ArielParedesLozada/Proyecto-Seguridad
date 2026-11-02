import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GoogleAuthButtonComponent } from '../../components/google-auth-button/google-auth-button';
import { AuthIllustrationComponent } from '../../components/auth-illustration/auth-illustration';
import { UiBrandLogoComponent } from '../../../../shared/components/ui-brand-logo/ui-brand-logo';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, GoogleAuthButtonComponent, AuthIllustrationComponent, UiBrandLogoComponent],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  private readonly route = inject(ActivatedRoute);
  readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
}
