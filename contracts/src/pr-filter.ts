export const PR_FILTERS = ['all', 'mine', 'review'] as const;
export type PrFilter = (typeof PR_FILTERS)[number];

export function isPrFilter(value: unknown): value is PrFilter {
  return typeof value === 'string' && (PR_FILTERS as readonly string[]).includes(value);
}
