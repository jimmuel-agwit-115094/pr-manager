import { Injectable, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { UserApi } from '../data-access/user.api';
import { toApiError } from '../data-access/api-error';

@Injectable({ providedIn: 'root' })
export class CurrentUserStore {
  private readonly api = inject(UserApi);

  private readonly resource = rxResource({ stream: () => this.api.me() });

  readonly user = computed(() => (this.resource.hasValue() ? this.resource.value() : null));
  readonly error = computed(() => (this.resource.error() ? toApiError(this.resource.error()) : null));
}
