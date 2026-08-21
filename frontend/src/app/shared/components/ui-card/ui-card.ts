import { Component, input } from '@angular/core';
@Component({ selector: 'app-ui-card', standalone: true, templateUrl: './ui-card.html', styleUrl: './ui-card.css' })
export class UiCardComponent { readonly title = input<string>(); readonly subtitle = input<string>(); }
