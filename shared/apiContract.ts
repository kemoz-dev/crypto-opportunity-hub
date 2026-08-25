export const API_CONTRACT_VERSION = "1.0.0" as const;
export const API_COMPATIBILITY_POLICY = "additive-within-v1" as const;
export const API_LEGACY_ENDPOINT = "/api/trpc" as const;
export const API_VERSIONED_ENDPOINT = "/api/v1/trpc" as const;

export const PORTABLE_CLIENTS = ["web", "pwa", "tauri", "native"] as const;
export type PortableClient = (typeof PORTABLE_CLIENTS)[number];

export const API_ERROR_KINDS = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "RATE_LIMITED",
  "PROVIDER_UNAVAILABLE",
  "DATA_UNAVAILABLE",
  "SERVER_ERROR",
] as const;
export type ApiErrorKind = (typeof API_ERROR_KINDS)[number];

export const PUBLIC_CLIENT_CONFIG_KEYS = ["VITE_API_BASE_URL", "VITE_APP_ID", "VITE_OAUTH_PORTAL_URL", "VITE_ANALYTICS_ENDPOINT", "VITE_ANALYTICS_WEBSITE_ID", "VITE_APP_TITLE", "VITE_APP_LOGO"] as const;
export const SERVER_CONFIG_KEYS = ["OAUTH_SERVER_URL", "OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_REDIRECT_URI", "OWNER_OPEN_ID", "OWNER_NAME", "NODE_ENV", "BUILT_IN_FORGE_API_URL", "VITE_FRONTEND_FORGE_API_URL"] as const;
export const SECRET_CONFIG_KEYS = ["DATABASE_URL", "JWT_SECRET", "BUILT_IN_FORGE_API_KEY", "VITE_FRONTEND_FORGE_API_KEY", "SCHEDULER_SIGNING_KEY", "STORAGE_SIGNING_SECRET", "OIDC_CLIENT_SECRET"] as const;

export const PORTABLE_FEATURE_CONTRACTS = {
  paperTrading: {
    authority: "server",
    operations: ["paperPortfolio", "openPaperTrade", "closePaperTrade", "immutableEntrySnapshot"],
    clientMaySubmit: ["assetId", "side", "riskPercent", "tradeId"],
    clientMayNotSubmit: ["entryPrice", "currentPrice", "score", "pnl", "immutableSnapshot"],
  },
  assetIntelligence: {
    authority: "server",
    operations: ["assetIntelligence"],
    guarantees: ["canonicalScore", "technicalMatrix", "provenance", "freshness", "unavailableStates"],
  },
  researchLab: {
    authority: "server",
    operations: ["researchExperiments", "researchExperiment", "runResearchExperiment", "exportResearchExperiment"],
    guarantees: ["serverCalculation", "userScopedPersistence", "datasetVersion", "methodology"],
  },
} as const;

export function normalizeApiErrorKind(code: unknown): ApiErrorKind {
  switch (code) {
    case "UNAUTHORIZED":
      return "UNAUTHENTICATED";
    case "FORBIDDEN":
      return "FORBIDDEN";
    case "BAD_REQUEST":
    case "PARSE_ERROR":
      return "VALIDATION_ERROR";
    case "NOT_FOUND":
      return "NOT_FOUND";
    case "TOO_MANY_REQUESTS":
      return "RATE_LIMITED";
    default:
      return "SERVER_ERROR";
  }
}

export function getApiContractMetadata() {
  return {
    version: API_CONTRACT_VERSION,
    compatibility: API_COMPATIBILITY_POLICY,
    activeEndpoint: API_LEGACY_ENDPOINT,
    versionedEndpoint: API_VERSIONED_ENDPOINT,
    supportedClients: PORTABLE_CLIENTS,
    errorKinds: API_ERROR_KINDS,
    features: PORTABLE_FEATURE_CONTRACTS,
  } as const;
}
