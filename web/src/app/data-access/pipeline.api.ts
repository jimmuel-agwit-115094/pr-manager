import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { PrPipeline } from '@pr-manager/contracts';
import type { Observable } from 'rxjs';
import { prPath, type PrKey } from './pull-request.api';

@Injectable({ providedIn: 'root' })
export class PipelineApi {
  private readonly http = inject(HttpClient);

  get(key: PrKey): Observable<PrPipeline> {
    return this.http.get<PrPipeline>(`${prPath(key)}/pipeline`);
  }

  queue(key: PrKey): Observable<PrPipeline> {
    return this.http.post<PrPipeline>(`${prPath(key)}/pipeline/queue`, null);
  }

  requeue(key: PrKey): Observable<PrPipeline> {
    return this.http.post<PrPipeline>(`${prPath(key)}/pipeline/requeue`, null);
  }
}
