import type { ErrorRequestHandler } from 'express';
import type { ApiError } from '@pr-manager/contracts';
import { AppError } from '../errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const body: ApiError =
    err instanceof AppError
      ? { status: err.status, message: err.message, resetAt: err.resetAt }
      : { status: 500, message: 'Unexpected server error.' };

  if (body.status >= 500) {
    console.error(err);
  }
  res.status(body.status).json(body);
};
