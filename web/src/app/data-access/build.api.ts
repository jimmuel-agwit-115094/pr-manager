import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { PrBuild, PrBuildLog, RetryStageRequest } from '@pr-manager/contracts';
import type { Observable } from 'rxjs';
import { prPath, type PrKey } from './pull-request.api';

/** Azure Pipelines builds (ADO timeline) for a PR. HTTP only. */
@Injectable({ providedIn: 'root' })
export class BuildApi {
  private readonly http = inject(HttpClient);

  list(key: PrKey): Observable<PrBuild[]> {
    return this.http.get<PrBuild[]>(`${prPath(key)}/builds`);
  }

  log(key: PrKey, buildId: number, logId: number): Observable<PrBuildLog> {
    return this.http.get<PrBuildLog>(`${prPath(key)}/builds/${buildId}/logs/${logId}`);
  }

  retryStage(key: PrKey, buildId: number, stage: string, allJobs: boolean): Observable<PrBuild[]> {
    const body: RetryStageRequest = { allJobs };
    return this.http.post<PrBuild[]>(`${prPath(key)}/builds/${buildId}/stages/${encodeURIComponent(stage)}/retry`, body);
  }

  retryFailed(key: PrKey, buildId: number): Observable<PrBuild[]> {
    return this.http.post<PrBuild[]>(`${prPath(key)}/builds/${buildId}/retry`, null);
  }
}
