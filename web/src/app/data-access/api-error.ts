import { HttpErrorResponse } from '@angular/common/http';
import type { ApiError } from '@pr-manager/contracts';

/** Normalise any HTTP failure into the server's ApiError shape. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as Partial<ApiError> | null;
    if (body && typeof body.message === 'string') {
      return { status: err.status, message: body.message, resetAt: body.resetAt };
    }
    if (err.status === 0 || err.status === 504) {
      return { status: err.status, message: 'Cannot reach the server. Is `npm run dev` running?' };
    }
    return { status: err.status, message: err.message };
  }
  return { status: 0, message: err instanceof Error ? err.message : 'Unknown error.' };
}
