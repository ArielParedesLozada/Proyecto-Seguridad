import { Component } from '@angular/core';
import {
  LucideFileCode2,
  LucideFiles,
  LucideHelpCircle,
  LucideMessageSquare,
  LucideSettings,
} from '@lucide/angular';
import { EditorToolbarComponent } from '../../features/editor/components/editor-toolbar/editor-toolbar';
import { UiSplitPaneComponent } from '../../shared/components/ui-split-pane/ui-split-pane';

@Component({
  selector: 'app-editor-layout',
  standalone: true,
  imports: [
    LucideFileCode2,
    LucideFiles,
    LucideHelpCircle,
    LucideMessageSquare,
    LucideSettings,
    EditorToolbarComponent,
    UiSplitPaneComponent,
  ],
  templateUrl: './editor-layout.html',
  styleUrl: './editor-layout.css',
})
export class EditorLayoutComponent {}
