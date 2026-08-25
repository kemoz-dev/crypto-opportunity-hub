import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  API_CONTRACT_VERSION,
  API_LEGACY_ENDPOINT,
  API_VERSIONED_ENDPOINT,
  PORTABLE_FEATURE_CONTRACTS,
  SECRET_CONFIG_KEYS,
  getApiContractMetadata,
} from "../shared/apiContract";
import { getApiUrl, resolveApiBaseUrl } from "../client/src/lib/runtimeConfig";
import { createPkceChallenge, createPkceVerifier } from "../client/src/lib/authClient";
import { PortableApiError, getApiErrorKind } from "./_core/apiErrors";

describe("Phase 1 portable API contract", () => {
  it("keeps same-origin as the safe default and validates explicit API origins", () => {
    expect(resolveApiBaseUrl(undefined)).toBe("");
    expect(resolveApiBaseUrl("https://api.example.test/")).toBe("https://api.example.test");
    expect(resolveApiBaseUrl("http://localhost:3000/")).toBe("http://localhost:3000");
    expect(() => resolveApiBaseUrl("http://api.example.test")).toThrow(/HTTPS/);
    expect(getApiUrl()).toBe(API_LEGACY_ENDPOINT);
  });

  it("publishes one versioned metadata boundary without changing the legacy endpoint", () => {
    const metadata = getApiContractMetadata();
    expect(metadata.version).toBe(API_CONTRACT_VERSION);
    expect(metadata.activeEndpoint).toBe(API_LEGACY_ENDPOINT);
    expect(metadata.versionedEndpoint).toBe(API_VERSIONED_ENDPOINT);
    expect(metadata.features.paperTrading.authority).toBe("server");
    expect(metadata.features.paperTrading.clientMayNotSubmit).toContain("entryPrice");
    expect(PORTABLE_FEATURE_CONTRACTS.assetIntelligence.guarantees).toContain("provenance");
    expect(PORTABLE_FEATURE_CONTRACTS.researchLab.guarantees).toContain("serverCalculation");
  });

  it("prepares PKCE S256 values without inventing or configuring an identity provider", async () => {
    const verifier = createPkceVerifier();
    const challenge = await createPkceChallenge(verifier);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).not.toBe(verifier);
  });

  it("normalizes portable errors without exposing implementation details", () => {
    expect(getApiErrorKind(new PortableApiError("PROVIDER_UNAVAILABLE", "Provider unavailable."))).toBe("PROVIDER_UNAVAILABLE");
    expect(getApiErrorKind({ code: "UNAUTHORIZED" })).toBe("UNAUTHENTICATED");
  });

  it("does not reference server secrets from client source", () => {
    const clientSources = [
      "client/src/main.tsx",
      "client/src/const.ts",
      "client/src/lib/runtimeConfig.ts",
      "client/src/lib/authClient.ts",
      "client/index.html",
    ].map(file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8")).join("\n");
    for (const secret of SECRET_CONFIG_KEYS) {
      expect(clientSources).not.toContain(secret);
    }
  });
});
