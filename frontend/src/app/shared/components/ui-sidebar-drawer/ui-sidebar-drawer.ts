import { Component, model } from '@angular/core';
@Component({
  selector: 'app-ui-sidebar-drawer',
  standalone: true,
  templateUrl: './ui-sidebar-drawer.html',
  styleUrl: './ui-sidebar-drawer.css',
})
export class UiSidebarDrawerComponent {
  readonly visible = model(false);
}
