export interface ApiError {
  status: number;
  message: string;
  /** ISO timestamp when the GitHub rate limit resets (429 only). */
  resetAt?: string;
}
