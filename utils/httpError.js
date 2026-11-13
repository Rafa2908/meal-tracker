// An error that carries an HTTP status. Throw it from anywhere in a request
// and errorMiddleware turns it into the right response.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
