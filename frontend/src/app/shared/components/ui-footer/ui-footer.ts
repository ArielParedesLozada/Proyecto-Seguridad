import { Component, input } from '@angular/core';

@Component({
  selector: 'app-ui-footer',
  standalone: true,
  templateUrl: './ui-footer.html',
  styleUrl: './ui-footer.css',
})
export class UiFooterComponent {
  readonly productName = input('LatexLab');
  readonly version = input('v0.1.0');
  readonly year = input(new Date().getFullYear());
}
