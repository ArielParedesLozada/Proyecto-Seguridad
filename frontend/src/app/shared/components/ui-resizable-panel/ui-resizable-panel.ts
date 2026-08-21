import { Component, input } from '@angular/core';
@Component({
  selector: 'app-ui-resizable-panel',
  standalone: true,
  templateUrl: './ui-resizable-panel.html',
  styleUrl: './ui-resizable-panel.css',
})
export class UiResizablePanelComponent {
  readonly size = input('18rem');
}
