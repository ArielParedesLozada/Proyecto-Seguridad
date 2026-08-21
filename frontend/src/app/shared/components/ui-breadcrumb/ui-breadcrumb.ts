import { Component, input, output } from '@angular/core';
@Component({
  selector: 'app-ui-breadcrumb',
  standalone: true,
  templateUrl: './ui-breadcrumb.html',
  styleUrl: './ui-breadcrumb.css',
})
export class UiBreadcrumbComponent {
  readonly items = input<string[]>([]);
  readonly selected = output<string>();
}
