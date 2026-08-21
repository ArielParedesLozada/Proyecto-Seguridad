import { Component, input } from '@angular/core';
@Component({
  selector: 'app-ui-presence-indicator',
  standalone: true,
  templateUrl: './ui-presence-indicator.html',
  styleUrl: './ui-presence-indicator.css',
})
export class UiPresenceIndicatorComponent {
  readonly label = input('En línea');
  readonly online = input(true);
}
