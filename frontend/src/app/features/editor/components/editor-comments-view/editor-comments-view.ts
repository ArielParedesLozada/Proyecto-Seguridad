import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LucideMessageSquare, LucideX } from '@lucide/angular';
import { UiButtonComponent } from '../../../../shared/components/ui-button/ui-button';
import { UiEmptyStateComponent } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiTooltipComponent } from '../../../../shared/components/ui-tooltip/ui-tooltip';
import { EditorComment } from '../../models/editor-comment.interface';

@Component({
  selector: 'app-editor-comments-view',
  standalone: true,
  imports: [
    LucideMessageSquare,
    LucideX,
    UiButtonComponent,
    UiEmptyStateComponent,
    UiTooltipComponent,
  ],
  templateUrl: './editor-comments-view.html',
  styleUrl: './editor-comments-view.css',
})
export class EditorCommentsViewComponent {
  private readonly injector = inject(Injector);
  private readonly commentInput = viewChild<ElementRef<HTMLTextAreaElement>>('commentInput');

  readonly comments = input<EditorComment[]>([]);
  readonly focusRequest = input(0);
  readonly closed = output<void>();
  readonly commentAdded = output<string>();
  readonly draft = signal('');

  constructor() {
    effect(() => {
      if (!this.focusRequest()) return;
      afterNextRender(() => this.commentInput()?.nativeElement.focus(), {
        injector: this.injector,
      });
    });
  }

  cancel(): void {
    this.draft.set('');
  }

  submit(): void {
    const content = this.draft().trim();
    if (!content) return;
    this.commentAdded.emit(content);
    this.draft.set('');
  }
}
