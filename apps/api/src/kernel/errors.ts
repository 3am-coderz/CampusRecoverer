export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, code = 'BAD_REQUEST') {
    super(400, code, message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not Found', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(409, code, message);
  }
}

export class UnprocessableEntityError extends ApiError {
  constructor(message = 'Unprocessable Entity', code = 'UNPROCESSABLE_ENTITY') {
    super(422, code, message);
  }
}
