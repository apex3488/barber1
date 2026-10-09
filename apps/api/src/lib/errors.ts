export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(message = "Не найдено") {
  return new AppError(404, "NOT_FOUND", message);
}

export function badRequest(message: string, code = "BAD_REQUEST") {
  return new AppError(400, code, message);
}

export function unprocessable(message: string, code: string) {
  return new AppError(422, code, message);
}

export function conflict(message: string, code = "CONFLICT") {
  return new AppError(409, code, message);
}
