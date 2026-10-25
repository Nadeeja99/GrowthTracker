// An error whose message is safe to show to API clients. The central error
// handler responds with `statusCode` and `message` for these.
export class HttpError extends Error {
  readonly statusCode: number;
  readonly isOperational = true;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}
