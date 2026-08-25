import { normalizeApiErrorKind, type ApiErrorKind } from "@shared/apiContract";
import { TRPCClientError } from "@trpc/client";

export type NormalizedApiError = {
  kind: ApiErrorKind;
  message: string;
  retryable: boolean;
};

export function normalizeClientApiError(error: unknown): NormalizedApiError | null {
  if (!(error instanceof TRPCClientError)) return null;
  const explicitKind = error.data?.apiError as ApiErrorKind | undefined;
  const kind = explicitKind ?? normalizeApiErrorKind(error.data?.code);
  return {
    kind,
    message: error.message,
    retryable: kind === "RATE_LIMITED" || kind === "PROVIDER_UNAVAILABLE" || kind === "DATA_UNAVAILABLE" || kind === "SERVER_ERROR",
  };
}
