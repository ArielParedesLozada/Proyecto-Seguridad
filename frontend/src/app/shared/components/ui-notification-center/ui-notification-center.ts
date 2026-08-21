import { Component, input } from '@angular/core';
@Component({
  selector: 'app-ui-notification-center',
  standalone: true,
  templateUrl: './ui-notification-center.html',
  styleUrl: './ui-notification-center.css',
})
export class UiNotificationCenterComponent {
  readonly notifications = input<string[]>([]);
}
