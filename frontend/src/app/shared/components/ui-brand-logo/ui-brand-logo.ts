import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-ui-brand-logo',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './ui-brand-logo.html',
  styleUrl: './ui-brand-logo.css',
})
export class UiBrandLogoComponent {
  readonly link = input('/');
  readonly ariaLabel = input('CipherTex, ir al inicio');
}
