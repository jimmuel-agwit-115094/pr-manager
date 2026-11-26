import type { HttpInterceptorFn } from '@angular/common/http';

/** The server rejects state-changing /api calls without this header (blocks cross-site requests). */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET' || !req.url.startsWith('/api/')) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'x-pr-manager': '1' } }));
};
