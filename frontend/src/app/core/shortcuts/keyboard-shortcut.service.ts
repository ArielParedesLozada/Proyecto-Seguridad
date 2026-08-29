import { Injectable } from '@angular/core';
import { KEYBOARD_SHORTCUTS, KeyboardShortcutAction } from './keyboard-shortcuts';

@Injectable({ providedIn: 'root' })
export class KeyboardShortcutService {
  matches(event: KeyboardEvent, action: KeyboardShortcutAction): boolean {
    const shortcut = KEYBOARD_SHORTCUTS[action];
    const usesModifier = shortcut.ctrlOrMeta ? event.ctrlKey || event.metaKey : true;

    return usesModifier && event.key.toLowerCase() === shortcut.key.toLowerCase();
  }
}
