import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { NewReviewComment, PrReviewThread, ReviewReply, ThreadStatusChange } from '@pr-manager/contracts';
import type { Observable } from 'rxjs';
import { prPath, type PrKey } from './pull-request.api';

/** Inline review threads. Writes return the refreshed list. HTTP only. */
@Injectable({ providedIn: 'root' })
export class ReviewApi {
  private readonly http = inject(HttpClient);

  threads(key: PrKey): Observable<PrReviewThread[]> {
    return this.http.get<PrReviewThread[]>(`${prPath(key)}/threads`);
  }

  create(key: PrKey, comment: NewReviewComment): Observable<PrReviewThread[]> {
    return this.http.post<PrReviewThread[]>(`${prPath(key)}/threads`, comment);
  }

  reply(key: PrKey, commentId: number, reply: ReviewReply): Observable<PrReviewThread[]> {
    return this.http.post<PrReviewThread[]>(`${prPath(key)}/threads/${commentId}/replies`, reply);
  }

  setResolved(key: PrKey, threadId: string, change: ThreadStatusChange): Observable<PrReviewThread[]> {
    return this.http.put<PrReviewThread[]>(`${prPath(key)}/threads/${encodeURIComponent(threadId)}/status`, change);
  }
}
