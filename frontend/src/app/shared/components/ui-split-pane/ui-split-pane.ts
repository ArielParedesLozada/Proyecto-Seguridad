import { Component, input } from '@angular/core';
@Component({
  selector: 'app-ui-split-pane',
  standalone: true,
  templateUrl: './ui-split-pane.html',
  styleUrl: './ui-split-pane.css',
})
export class UiSplitPaneComponent {
  readonly firstSize = input('30%');
}
