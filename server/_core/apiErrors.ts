import { TRPCError } from "@trpc/server";
import { normalizeApiErrorKind, type ApiErrorKind } from "@shared/apiContract";

const TRPC_CODE_BY_KIND: Record<ApiErrorKind, TRPCError["code"]> = {
  UNAUTHENTICATED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION_ERROR: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "TOO_MANY_REQUESTS",
  PROVIDER_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DATA_UNAVAILABLE: "PRECONDITION_FAILED",
  SERVER_ERROR: "INTERNAL_SERVER_ERROR",
};

export class PortableApiError extends TRPCError {
  readonly apiError: ApiErrorKind;

  constructor(apiError: ApiErrorKind, message: string) {
    super({ code: TRPC_CODE_BY_KIND[apiError], message, cause: { apiError } });
    this.apiError = apiError;
  }
}

export function getApiErrorKind(error: unknown): ApiErrorKind {
  if (error instanceof PortableApiError) return error.apiError;
  if (error && typeof error === "object" && "cause" in error) {
    const cause = (error as { cause?: unknown }).cause;
    if (cause && typeof cause === "object" && "apiError" in cause) {
      const apiError = (cause as { apiError?: unknown }).apiError;
      if (typeof apiError === "string") return apiError as ApiErrorKind;
    }
  }
  if (error && typeof error === "object" && "code" in error) {
    return normalizeApiErrorKind((error as { code?: unknown }).code);
  }
  return "SERVER_ERROR";
}
