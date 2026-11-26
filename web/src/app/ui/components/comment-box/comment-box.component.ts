import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, input, output, signal, viewChild } from '@angular/core';
import { applyMarkdown, type MarkdownFormat } from './markdown-format';

const TOOLS: { format: MarkdownFormat; label: string; icon: string }[] = [
  { format: 'bold', label: 'Bold', icon: 'B' },
  { format: 'italic', label: 'Italic', icon: 'I' },
  { format: 'code', label: 'Code', icon: '</>' },
  { format: 'link', label: 'Link', icon: '🔗︎' },
  { format: 'bullets', label: 'Bulleted list', icon: '•≡' },
  { format: 'numbers', label: 'Numbered list', icon: '1≡' },
  { format: 'tasks', label: 'Task list', icon: '☑≡' },
];

/** ADO-style comment editor: avatar, markdown textarea, formatting toolbar, Cancel / Comment. */
@Component({
  selector: 'app-comment-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comment-box.component.html',
  styleUrl: './comment-box.component.scss',
})
export class CommentBoxComponent {
  readonly avatarUrl = input('');
  readonly placeholder = input('Add a comment…');
  readonly submitLabel = input('Comment');
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly submitted = output<string>();
  readonly cancelled = output<void>();

  protected readonly tools = TOOLS;
  protected readonly body = signal('');
  protected readonly canSubmit = computed(() => !!this.body().trim() && !this.busy());

  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');

  constructor() {
    afterNextRender(() => this.textarea().nativeElement.focus());
  }

  protected format(format: MarkdownFormat): void {
    const el = this.textarea().nativeElement;
    const edit = applyMarkdown(el.value, el.selectionStart, el.selectionEnd, format);
    el.value = edit.text;
    this.body.set(edit.text);
    el.focus();
    el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  }

  protected submit(): void {
    if (this.canSubmit()) {
      this.submitted.emit(this.body().trim());
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.submit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelled.emit();
    }
  }
}
