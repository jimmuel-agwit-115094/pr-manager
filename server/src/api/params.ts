import { AppError } from '../errors';

export function parsePrNumber(value: unknown): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new AppError(400, `Invalid pull request number "${String(value)}".`);
  }
  return number;
}
