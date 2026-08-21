import { Component, input, output } from '@angular/core';
@Component({
  selector: 'app-ui-file-upload',
  standalone: true,
  templateUrl: './ui-file-upload.html',
  styleUrl: './ui-file-upload.css',
})
export class UiFileUploadComponent {
  readonly title = input('Selecciona o arrastra un archivo');
  readonly description = input('Archivos .zip, .tex, .bib o imágenes');
  readonly accept = input('.zip,.tex,.bib,image/*');
  readonly loading = input(false);
  readonly picked = output<File | undefined>();
}
