import { Elysia } from "elysia";

interface ErrorResponse {
  error: string;
  message: string;
  requestId?: string;
  statusCode: number;
}

const ERROR_CODE_MAP: Record<string, number> = {
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  VALIDATION_ERROR: 400,
};

const getStatusFromError = (error: Error): number => {
  const errorName = error.name.toUpperCase().replaceAll(" ", "_");
  return ERROR_CODE_MAP[errorName] ?? 500;
};

export const errorHandlerPlugin = new Elysia({ name: "errorHandler" }).onError(
  ({ code, error, set, ...rest }): ErrorResponse => {
    const reqId = (rest as { requestId?: string }).requestId;
    const isError = error instanceof Error;

    const respond = (
      statusCode: number,
      errorName: string,
      message: string
    ): ErrorResponse => {
      set.status = statusCode;
      return { error: errorName, message, requestId: reqId, statusCode };
    };

    if (code === "VALIDATION" && isError) {
      return respond(400, "Validation Error", error.message);
    }

    if (code === "NOT_FOUND") {
      return respond(404, "Not Found", "The requested resource was not found");
    }

    if (code === "PARSE") {
      return respond(400, "Parse Error", "Invalid request body");
    }

    if (isError) {
      return respond(
        getStatusFromError(error),
        error.name || "Error",
        error.message || "An unexpected error occurred"
      );
    }

    return respond(
      500,
      "Internal Server Error",
      "An unexpected error occurred"
    );
  }
);
