import { Component, input } from '@angular/core';
@Component({
  selector: 'app-ui-loading',
  standalone: true,
  templateUrl: './ui-loading.html',
  styleUrl: './ui-loading.css',
})
export class UiLoadingComponent {
  readonly label = input('Cargando…');
  readonly compact = input(false);
}
