import { Component, input } from '@angular/core';
@Component({ selector: 'app-ui-avatar', standalone: true, templateUrl: './ui-avatar.html', styleUrl: './ui-avatar.css' })
export class UiAvatarComponent { readonly name = input.required<string>(); readonly initials = input.required<string>(); readonly background = input('#dbeafe'); }
