import type { Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";
import { sdk, type AuthenticatedUser } from "./sdk";

export type AuthenticatedIdentity = {
  subject: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
};

export type OidcReadiness = {
  provider: "manus" | "oidc";
  configured: boolean;
  authorizationCodeFlow: true;
  pkce: "S256";
  issuerConfigured: boolean;
  clientIdConfigured: boolean;
  redirectUriConfigured: boolean;
};

export interface AuthAdapter {
  provider: "manus" | "oidc";
  authenticateRequest(request: Request): Promise<AuthenticatedUser>;
  exchangeAuthorizationCode(input: { code: string; state: string }): Promise<AuthenticatedIdentity>;
  createApplicationSession(identity: AuthenticatedIdentity, options?: { expiresInMs?: number }): Promise<string>;
  clearApplicationSession(response: Response, request: Request): void;
  getOidcReadiness(): OidcReadiness;
}

class ManusAuthAdapter implements AuthAdapter {
  readonly provider = "manus" as const;

  authenticateRequest(request: Request) {
    return sdk.authenticateRequest(request);
  }

  async exchangeAuthorizationCode(input: { code: string; state: string }): Promise<AuthenticatedIdentity> {
    const tokenResponse = await sdk.exchangeCodeForToken(input.code, input.state);
    const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
    if (!userInfo.openId) throw new Error("Authentication provider returned no subject.");
    return {
      subject: userInfo.openId,
      name: userInfo.name || null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    };
  }

  createApplicationSession(identity: AuthenticatedIdentity, options: { expiresInMs?: number } = {}) {
    return sdk.createSessionToken(identity.subject, { name: identity.name ?? "", expiresInMs: options.expiresInMs ?? ONE_YEAR_MS });
  }

  clearApplicationSession(response: Response, request: Request) {
    response.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(request), maxAge: -1 });
  }

  getOidcReadiness(): OidcReadiness {
    return {
      provider: "manus",
      configured: false,
      authorizationCodeFlow: true,
      pkce: "S256",
      issuerConfigured: Boolean(ENV.oidcIssuer),
      clientIdConfigured: Boolean(ENV.oidcClientId),
      redirectUriConfigured: Boolean(ENV.oidcRedirectUri),
    };
  }
}

const activeAuthAdapter: AuthAdapter = new ManusAuthAdapter();

export function getAuthAdapter(): AuthAdapter {
  return activeAuthAdapter;
}
