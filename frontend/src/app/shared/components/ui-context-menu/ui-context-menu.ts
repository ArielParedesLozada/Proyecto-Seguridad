import { Component, input, model, output } from '@angular/core';
export type UiContextAction = { id: string; label: string; danger?: boolean };
@Component({
  selector: 'app-ui-context-menu',
  standalone: true,
  templateUrl: './ui-context-menu.html',
  styleUrl: './ui-context-menu.css',
})
export class UiContextMenuComponent {
  readonly visible = model(false);
  readonly items = input<UiContextAction[]>([]);
  readonly chosen = output<string>();
}
