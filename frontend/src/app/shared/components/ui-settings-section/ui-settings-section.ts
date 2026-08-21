import { Component, input } from '@angular/core';
@Component({
  selector: 'app-ui-settings-section',
  standalone: true,
  templateUrl: './ui-settings-section.html',
  styleUrl: './ui-settings-section.css',
})
export class UiSettingsSectionComponent {
  readonly title = input.required<string>();
  readonly description = input('');
}
