import { API_LEGACY_ENDPOINT } from "@shared/apiContract";

export function resolveApiBaseUrl(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate) return "";

  const url = new URL(candidate);
  if (url.username || url.password) {
    throw new Error("VITE_API_BASE_URL must not include credentials.");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("VITE_API_BASE_URL must use HTTPS outside local development.");
  }
  return url.toString().replace(/\/$/, "");
}

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

export function getApiUrl(path = API_LEGACY_ENDPOINT): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

export function getAuthCallbackUrl(): string {
  if (API_BASE_URL) return `${API_BASE_URL}/api/oauth/callback`;
  return new URL("/api/oauth/callback", window.location.origin).toString();
}

export function getPublicRuntimeConfig() {
  return {
    apiBaseUrl: API_BASE_URL || null,
    apiMode: API_BASE_URL ? "explicit-origin" as const : "same-origin" as const,
  };
}
