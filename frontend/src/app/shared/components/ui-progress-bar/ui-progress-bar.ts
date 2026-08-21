import { Component, input } from '@angular/core';
@Component({
  selector: 'app-ui-progress-bar',
  standalone: true,
  templateUrl: './ui-progress-bar.html',
  styleUrl: './ui-progress-bar.css',
})
export class UiProgressBarComponent {
  readonly value = input(0);
  readonly label = input('');
}
