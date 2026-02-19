/* eslint-disable max-classes-per-file */
export class NotFoundError extends Error {
  constructor(message = "The requested resource was not found") {
    super(message);
    this.name = "Not Found";
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Bad Request";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Access denied") {
    super(message);
    this.name = "Forbidden";
  }
}
