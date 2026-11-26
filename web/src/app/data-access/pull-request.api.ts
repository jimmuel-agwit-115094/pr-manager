import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { PrFileView, PrFiles, PrFilter, PullRequestDetail, PullRequestSummary, Repo } from '@pr-manager/contracts';
import type { Observable } from 'rxjs';

export interface PrKey {
  owner: string;
  repo: string;
  number: number;
}

export function prPath({ owner, repo, number }: PrKey): string {
  return `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`;
}

/** HTTP only. No state, no business rules. */
@Injectable({ providedIn: 'root' })
export class PullRequestApi {
  private readonly http = inject(HttpClient);

  list(repo: Repo, filter: PrFilter, search: string): Observable<PullRequestSummary[]> {
    let params = new HttpParams().set('filter', filter);
    if (search) {
      params = params.set('q', search);
    }
    const path = `/api/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/pulls`;
    return this.http.get<PullRequestSummary[]>(path, { params });
  }

  get(key: PrKey): Observable<PullRequestDetail> {
    return this.http.get<PullRequestDetail>(prPath(key));
  }

  approve(key: PrKey): Observable<PullRequestDetail> {
    return this.http.post<PullRequestDetail>(`${prPath(key)}/approve`, null);
  }

  files(key: PrKey): Observable<PrFiles> {
    return this.http.get<PrFiles>(`${prPath(key)}/files`);
  }

  fileView(key: PrKey, path: string): Observable<PrFileView> {
    return this.http.get<PrFileView>(`${prPath(key)}/files/view`, { params: { path } });
  }
}
