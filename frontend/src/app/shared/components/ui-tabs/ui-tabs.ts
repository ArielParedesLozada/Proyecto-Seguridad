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
  readonly minimumOpenTabs = input(0);
  readonly selected = output<string>();
  readonly closed = output<string>();

  canClose(tab: UiTab): boolean {
    return this.tabs().length > this.minimumOpenTabs() && tab.id !== '';
  }

  requestClose(tab: UiTab): void {
    if (this.canClose(tab)) this.closed.emit(tab.id);
  }
}
