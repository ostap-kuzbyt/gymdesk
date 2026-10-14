import { STATUS_CODES } from "node:http";
import type { FastifyError, FastifyInstance, FastifyReply } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";

export class DomainError extends Error {
  override readonly name = "DomainError";
}

export class NotFoundError extends Error {
  override readonly name = "NotFoundError";
}

export class ConflictError extends Error {
  override readonly name = "ConflictError";
}

interface ProblemDetails {
  type: "about:blank";
  title: string;
  status: number;
  detail: string;
  errors?: { path: string; message: string }[];
}

function sendProblem(
  reply: FastifyReply,
  status: number,
  detail: string,
  errors?: ProblemDetails["errors"],
): FastifyReply {
  const problem: ProblemDetails = {
    type: "about:blank",
    title: STATUS_CODES[status] ?? "Error",
    status,
    detail,
    ...(errors ? { errors } : {}),
  };
  return reply.code(status).type("application/problem+json").send(problem);
}

function isFastifyError(error: unknown): error is FastifyError {
  return error instanceof Error && "statusCode" in error && typeof error.statusCode === "number";
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) =>
    sendProblem(reply, 404, `Route ${request.method} ${request.url} was not found`),
  );

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof DomainError) return sendProblem(reply, 400, error.message);
    if (error instanceof NotFoundError) return sendProblem(reply, 404, error.message);
    if (error instanceof ConflictError) return sendProblem(reply, 409, error.message);

    if (hasZodFastifySchemaValidationErrors(error)) {
      const errors = error.validation.map((issue) => ({
        path: issue.instancePath.replace(/^\//, "").replaceAll("/", ".") || "(root)",
        message: issue.message ?? "Invalid value",
      }));
      return sendProblem(reply, 400, "Request validation failed", errors);
    }

    if (isFastifyError(error) && error.statusCode !== undefined && error.statusCode < 500) {
      return sendProblem(reply, error.statusCode, error.message);
    }

    request.log.error(error);
    return sendProblem(reply, 500, "An unexpected error occurred");
  });
}
