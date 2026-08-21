import { Component, input } from '@angular/core';
export type UiActivity = { title: string; detail: string; date: string };
@Component({
  selector: 'app-ui-activity-timeline',
  standalone: true,
  templateUrl: './ui-activity-timeline.html',
  styleUrl: './ui-activity-timeline.css',
})
export class UiActivityTimelineComponent {
  readonly activities = input<UiActivity[]>([]);
}
