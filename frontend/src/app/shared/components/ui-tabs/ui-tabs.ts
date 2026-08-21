import { Component, input, output } from '@angular/core';
export type UiTab = { id: string; label: string; dirty?: boolean };
@Component({
  selector: 'app-ui-tabs',
  standalone: true,
  templateUrl: './ui-tabs.html',
  styleUrl: './ui-tabs.css',
})
export class UiTabsComponent {
  readonly tabs = input<UiTab[]>([]);
  readonly activeId = input<string>();
  readonly selected = output<string>();
  readonly closed = output<string>();
}
