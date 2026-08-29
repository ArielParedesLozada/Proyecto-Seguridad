export const KEYBOARD_SHORTCUTS = {
  SAVE_DOCUMENT: { key: 's', ctrlOrMeta: true },
  FIND: { key: 'f', ctrlOrMeta: true },
  REPLACE: { key: 'h', ctrlOrMeta: true },
  UNDO: { key: 'z', ctrlOrMeta: true },
  REDO: { key: 'y', ctrlOrMeta: true },
  RECOMPILE: { key: 'Enter', ctrlOrMeta: true },
} as const;

export type KeyboardShortcutAction = keyof typeof KEYBOARD_SHORTCUTS;
