export function asyncWrapper(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export class APIError extends Error {
  constructor(message, statusCode, info) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.info = info;

    Error.captureStackTrace(this, this.constructor);
  }
}
