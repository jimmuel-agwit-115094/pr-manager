import type { RequestHandler } from 'express';

export const CSRF_HEADER = 'x-pr-manager';
const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/**
 * The server holds tokens that can approve PRs and queue builds, so only local callers may use it:
 * - Host must be localhost (blocks DNS-rebinding).
 * - State-changing requests need a custom header. Browsers can't send it cross-origin without a
 *   CORS preflight, which this server never grants, so other websites can't trigger actions.
 */
export const localOnly: RequestHandler = (req, res, next) => {
  if (!LOCAL_HOSTS.test(req.headers.host ?? '')) {
    res.status(403).json({ status: 403, message: 'Forbidden host.' });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.get(CSRF_HEADER) !== '1') {
    res.status(403).json({ status: 403, message: `Missing ${CSRF_HEADER} header.` });
    return;
  }
  next();
};
