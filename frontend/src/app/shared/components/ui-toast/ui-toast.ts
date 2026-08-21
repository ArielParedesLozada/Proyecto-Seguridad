import { Component } from '@angular/core';
import { Toast } from 'primeng/toast';
@Component({
  selector: 'app-ui-toast',
  standalone: true,
  imports: [Toast],
  templateUrl: './ui-toast.html',
  styleUrl: './ui-toast.css',
})
export class UiToastComponent {}
