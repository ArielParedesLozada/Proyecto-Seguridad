import { Component, ElementRef, ViewChild, input, output } from '@angular/core';
import { LucideSearch } from '@lucide/angular';
@Component({
  selector: 'app-ui-search-input',
  standalone: true,
  imports: [LucideSearch],
  templateUrl: './ui-search-input.html',
  styleUrl: './ui-search-input.css',
})
export class UiSearchInputComponent {
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  readonly placeholder = input('Buscar…');
  readonly value = input('');
  readonly changed = output<string>();

  focus(): void {
    this.searchInput?.nativeElement.focus();
  }
}
