import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { CurrentUser } from '@pr-manager/contracts';
import type { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserApi {
  private readonly http = inject(HttpClient);

  me(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>('/api/me');
  }
}
