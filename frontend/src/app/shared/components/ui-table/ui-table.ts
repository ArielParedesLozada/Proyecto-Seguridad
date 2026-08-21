import { Component, input } from '@angular/core';
export type UiTableColumn = { label: string; align?: 'left' | 'center' | 'right' };
@Component({
  selector: 'app-ui-table',
  standalone: true,
  templateUrl: './ui-table.html',
  styleUrl: './ui-table.css',
})
export class UiTableComponent {
  readonly columns = input<UiTableColumn[]>([]);
}
