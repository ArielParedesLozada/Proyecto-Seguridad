import { Component, input } from '@angular/core';
@Component({
  selector: 'app-ui-skeleton',
  standalone: true,
  templateUrl: './ui-skeleton.html',
  styleUrl: './ui-skeleton.css',
})
export class UiSkeletonComponent {
  readonly width = input('100%');
  readonly height = input('1rem');
  readonly circle = input(false);
}
