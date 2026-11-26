import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Repo } from '@pr-manager/contracts';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RepoApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Repo[]> {
    return this.http.get<Repo[]>('/api/repos');
  }
}
