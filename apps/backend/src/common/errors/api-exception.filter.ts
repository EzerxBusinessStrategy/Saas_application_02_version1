import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { REQUEST_ID_HEADER, resolveRequestId } from "../request-id/request-id";
import { ApiErrorResponse, ValidationErrorDetailDto } from "./api-error.dto";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const requestId = resolveRequestId(request.headers[REQUEST_ID_HEADER], request.id);
    const normalized = normalizeException(exception);

    // Log unexpected 500 errors with full details for debugging
    if (normalized.statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('[ApiExceptionFilter] Internal server error:', {
        requestId,
        method: request.method,
        url: request.url,
        exception,
      });
    }

    reply.header(REQUEST_ID_HEADER, requestId).status(normalized.statusCode).send({
      error: {
        code: normalized.code,
        message: normalized.message,
        requestId,
        ...(normalized.details ? { details: normalized.details } : {}),
      },
    } satisfies ApiErrorResponse);
  }
}

type NormalizedException = {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly details?: readonly ValidationErrorDetailDto[];
};

function normalizeException(exception: unknown): NormalizedException {
  if (!(exception instanceof HttpException)) {
    const databaseException = normalizeDatabaseException(exception);
    if (databaseException) return databaseException;
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error.",
    };
  }

  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  const body = isRecord(response) ? response : {};
  const code = typeof body.code === "string" ? body.code : codeForStatus(statusCode);
  const message = messageForBody(body, response, statusCode);
  const details = statusCode === HttpStatus.BAD_REQUEST ? detailsForBody(body) : undefined;

  return { statusCode, code, message, details };
}

function normalizeDatabaseException(exception: unknown): NormalizedException | undefined {
  const code = databaseErrorCode(exception);
  switch (code) {
    case "23505":
      return { statusCode: HttpStatus.CONFLICT, code: "CONFLICT", message: "A record with one of these values already exists." };
    case "23502":
    case "23503":
    case "23514":
    case "22P02":
    case "22007":
      return { statusCode: HttpStatus.BAD_REQUEST, code: "INVALID_REQUEST", message: "One or more submitted values are invalid." };
    case "42501":
      return { statusCode: HttpStatus.FORBIDDEN, code: "FORBIDDEN", message: "Access denied." };
    case "42P01":
    case "42703":
      return { statusCode: HttpStatus.SERVICE_UNAVAILABLE, code: "DATABASE_SCHEMA_UNAVAILABLE", message: "The service is being updated. Please try again shortly." };
    case "53300":
    case "57P01":
    case "08000":
    case "08001":
    case "08006":
      return { statusCode: HttpStatus.SERVICE_UNAVAILABLE, code: "DATABASE_UNAVAILABLE", message: "The service is temporarily unavailable. Please try again shortly." };
    case "57014":
      return { statusCode: HttpStatus.GATEWAY_TIMEOUT, code: "DATABASE_TIMEOUT", message: "The request took too long. Please try again." };
    default:
      return undefined;
  }
}

function databaseErrorCode(exception: unknown): string | undefined {
  if (!isRecord(exception)) return undefined;
  return typeof exception.code === "string" ? exception.code : undefined;
}

function messageForBody(body: Record<string, unknown>, response: string | object, statusCode: number): string {
  if (typeof body.message === "string") return body.message;
  if (Array.isArray(body.message)) return "Request validation failed.";
  if (typeof response === "string") return response;
  return defaultMessageForStatus(statusCode);
}

function detailsForBody(body: Record<string, unknown>): readonly ValidationErrorDetailDto[] | undefined {
  const details = body.details;
  if (!Array.isArray(details)) return undefined;
  return details.filter(isValidationDetail);
}

function isValidationDetail(value: unknown): value is ValidationErrorDetailDto {
  return isRecord(value) && typeof value.path === "string" && typeof value.message === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function codeForStatus(statusCode: number): string {
  switch (statusCode) {
    case HttpStatus.BAD_REQUEST:
      return "BAD_REQUEST";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHORIZED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    case HttpStatus.PRECONDITION_FAILED:
      return "PRECONDITION_FAILED";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "TOO_MANY_REQUESTS";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

function defaultMessageForStatus(statusCode: number): string {
  switch (statusCode) {
    case HttpStatus.BAD_REQUEST:
      return "Bad request.";
    case HttpStatus.UNAUTHORIZED:
      return "Authentication required.";
    case HttpStatus.FORBIDDEN:
      return "Access denied.";
    case HttpStatus.NOT_FOUND:
      return "Resource not found.";
    case HttpStatus.CONFLICT:
      return "Request conflicts with current state.";
    case HttpStatus.PRECONDITION_FAILED:
      return "Expected version check failed.";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "Too many requests.";
    default:
      return "Unexpected server error.";
  }
}
