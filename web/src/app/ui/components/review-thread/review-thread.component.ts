import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { PrReviewThread } from '@pr-manager/contracts';
import { TimeAgoPipe } from '../../pipes/time-ago.pipe';
import { CommentBoxComponent } from '../comment-box/comment-box.component';

/** One review thread: its comments (GitHub-rendered markdown), status with Resolve / Reactivate, and a reply box. */
@Component({
  selector: 'app-review-thread',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommentBoxComponent, TimeAgoPipe],
  host: { '[class.framed]': 'framed()' },
  templateUrl: './review-thread.component.html',
  styleUrl: './review-thread.component.scss',
})
export class ReviewThreadComponent {
  readonly thread = input.required<PrReviewThread>();
  /** Draws its own card (inline in Files Changed). Off when a parent card already frames it. */
  readonly framed = input(true);
  readonly viewerAvatar = input('');
  readonly replying = input(false);
  readonly posting = input(false);
  readonly error = input<string | null>(null);
  readonly statusBusy = input(false);
  readonly statusError = input<string | null>(null);

  /** true = resolve, false = reactivate. */
  readonly statusChanged = output<boolean>();
  readonly replyOpened = output<void>();
  readonly replySubmitted = output<string>();
  readonly replyCancelled = output<void>();
}
