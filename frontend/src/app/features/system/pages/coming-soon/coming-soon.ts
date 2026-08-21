import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideConstruction } from '@lucide/angular';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [RouterLink, LucideArrowLeft, LucideConstruction],
  templateUrl: './coming-soon.html',
  styleUrl: './coming-soon.css',
})
export class ComingSoonComponent {
  private readonly route = inject(ActivatedRoute);
  readonly title = computed(() => this.route.snapshot.data['title'] as string);
  readonly description = computed(() => this.route.snapshot.data['description'] as string);
}
