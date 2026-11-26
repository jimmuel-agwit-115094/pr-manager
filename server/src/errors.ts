/** Error carrying an HTTP status. Thrown by any layer; translated to a response by the api layer. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly resetAt?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
