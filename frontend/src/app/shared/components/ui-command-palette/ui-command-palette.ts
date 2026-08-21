import { Component, model, input, output } from '@angular/core';
@Component({
  selector: 'app-ui-command-palette',
  standalone: true,
  templateUrl: './ui-command-palette.html',
  styleUrl: './ui-command-palette.css',
})
export class UiCommandPaletteComponent {
  readonly visible = model(false);
  readonly commands = input<string[]>([]);
  readonly chosen = output<string>();
}
