import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";
import { getAuthCallbackUrl } from "./runtimeConfig";

export type OidcAuthorizationRequest = {
  issuer: string;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
};

export type BrowserAuthClient = {
  provider: "manus" | "oidc";
  startLogin: () => void | Promise<void>;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createPkceVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function createPkceChallenge(verifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toBase64Url(new Uint8Array(digest));
}

export async function createOidcAuthorizationRequest(input: { issuer: string; clientId: string; redirectUri?: string }): Promise<{ request: OidcAuthorizationRequest; verifier: string }> {
  const verifier = createPkceVerifier();
  const nonce = crypto.randomUUID();
  const state = crypto.randomUUID();
  return {
    verifier,
    request: {
      issuer: input.issuer.replace(/\/$/, ""),
      clientId: input.clientId,
      redirectUri: input.redirectUri ?? getAuthCallbackUrl(),
      state,
      nonce,
      codeChallenge: await createPkceChallenge(verifier),
      codeChallengeMethod: "S256",
    },
  };
}

const manusAuthClient: BrowserAuthClient = {
  provider: "manus",
  startLogin() {
    const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
    const appId = import.meta.env.VITE_APP_ID;
    const redirectUri = getAuthCallbackUrl();
    const nonce = crypto.randomUUID();
    document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
    const state = encodeOAuthState({ redirectUri, nonce });
    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    window.location.href = url.toString();
  },
};

export function getBrowserAuthClient(): BrowserAuthClient {
  // Phase 1 keeps Manus as the active provider. OIDC request construction is
  // available for a later configured provider; no identity provider is invented.
  return manusAuthClient;
}

export const startLogin = () => getBrowserAuthClient().startLogin();
