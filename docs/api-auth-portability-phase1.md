# API/Auth Portability — Phase 1 Implementation

## Status and Boundaries

Phase 1 makes the existing application **client-agnostic at the integration boundary** while retaining Manus as the active authentication, scheduler, storage, notification, and hosting provider. It does not introduce a PWA, a Tauri/Electron client, an identity-provider migration, native notifications, a queue, a schema migration, or an infrastructure migration.

> The API and database remain authoritative. Web, a future PWA, and a future Windows client may render or request actions, but none may authoritatively calculate scores, prices, P&L, trade evidence, research results, alerts, provider health, or schedules.

## API Origin and Versioning

The client now resolves tRPC through `client/src/lib/runtimeConfig.ts`.

| Scenario | API URL behavior |
|---|---|
| Current web deployment | No `VITE_API_BASE_URL` means the existing same-origin `/api/trpc` URL remains active. |
| Development | An unset value uses the existing development proxy/same-origin behavior. An explicit local origin is permitted only for `localhost` or `127.0.0.1`. |
| Future staging/production external client | Set public `VITE_API_BASE_URL` to the approved HTTPS API origin. Credentials in URLs are rejected. |
| Future Tauri/PWA/native | Use the approved HTTPS origin; do not infer the API from the client app’s packaged origin. |

`/api/trpc` remains the compatibility endpoint. `/api/v1/trpc` now mounts the same router as an explicit versioned alias. The current contract version is returned by the public `system.contract` procedure along with the compatibility policy, supported client categories, normalized error categories, feature authority declarations, and OIDC readiness state. No business procedures were duplicated or removed.

Within API v1, changes must be additive. A breaking procedure/input/semantic change requires a new major path, documented deprecation window, a declared minimum client version, and compatibility tests against the prior route.

## Authentication and OIDC Readiness

`server/_core/authAdapter.ts` defines the server-facing `AuthAdapter`. The active `ManusAuthAdapter` delegates the existing code exchange, user lookup, application session, callback, and authenticated request behavior to the existing provider implementation. Business routers and tRPC context no longer call the provider SDK directly.

`client/src/lib/authClient.ts` defines the browser-facing login boundary. The current `Manus` login remains active and keeps the existing one-time state-cookie validation path. The module also provides an unconfigured OIDC authorization-code preparation API that creates a high-entropy verifier, `S256` PKCE challenge, state, nonce, and configurable redirect URI. It does not select or deploy an identity provider.

Future OIDC configuration is server-side only:

| Configuration | Classification | Phase 1 behavior |
|---|---|---|
| `VITE_API_BASE_URL` | Public client configuration | Optional API origin override. |
| `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL` | Existing public provider configuration | Used only by current Manus browser adapter. |
| `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID`, `VITE_APP_TITLE`, `VITE_APP_LOGO` | Public presentation/analytics configuration | May appear in the browser bundle; never carries authorization. |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_REDIRECT_URI`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `OWNER_NAME`, `NODE_ENV`, `BUILT_IN_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_URL` | Server/platform configuration | Read by server/runtime only; the frontend Forge URL is not used by Crypto Hub business code. |
| `DATABASE_URL`, `JWT_SECRET`, `BUILT_IN_FORGE_API_KEY`, `VITE_FRONTEND_FORGE_API_KEY` | Secret or prohibited client credential | Server-only. The frontend-named Forge key is explicitly prohibited from Crypto Hub client source and bundle. |
| Scheduler/storage signing keys, OIDC client secret, and private provider credentials | Secret | Not added to client configuration and not logged. |

The intended future standard is OIDC Authorization Code with PKCE S256, exact registered redirect URIs, state/nonce validation, short-lived access tokens, rotated/revocable refresh or server sessions, and server-derived authorization. OAuth security best practice requires public clients to use PKCE and exact redirect URI checks; native clients should use the system browser for authorization.[1] [2]

## Authorization and Error Boundaries

`protectedProcedure` and `adminProcedure` remain the authorization boundary. The context obtains a verified principal through `AuthAdapter`; it never trusts user, owner, role, portfolio, or alert ownership submitted by the client. Existing user-scoped Paper Trading, Research Lab, alert, settings, historical-data, and recovery-archive operations remain unchanged.

The tRPC error formatter now adds an `apiError` category while retaining normal tRPC codes and messages. The portable categories are `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `DATA_UNAVAILABLE`, and `SERVER_ERROR`. Existing callers stay compatible; specialized provider/data categories are available to future server procedures without leaking stack traces, database details, or credentials.

## Scheduler, Storage, and Notification Adapters

| Adapter | Active implementation | Preserved behavior | Future replacement point |
|---|---|---|---|
| `SchedulerAdapter` | Manus Heartbeat | Existing task UID, six-field UTC cron, enable/update/delete/list operations, cron-only callback verification, persisted task evidence | Signed service credential with issuer/audience/task/timestamp/jti validation and durable replay record. |
| `StorageAdapter` | Manus Forge signed object storage | Private object keys, server authorization, current signed recovery download URLs | S3-compatible private bucket and server-only presigning. |
| `NotificationAdapter` | Manus owner notification | Existing alert evaluation remains server-side and owner notification delivery remains unchanged | Web Push, email, Windows, and mobile adapters, all server initiated. |

Scheduled handlers now verify invocation through `SchedulerAdapter` rather than provider SDK calls in business handler files. Ordinary clients still receive `403 cron-only`; no scheduled route became public. The current adapter returns the existing authenticated cron principal. A future scheduler must retain task identity, timestamp validation, replay prevention, idempotency, and execution evidence.

## Portable Feature Contracts

### Paper Trading

The public contract metadata declares Paper Trading server authority. The client may submit only an asset ID, intended simulated side, permitted risk percentage, or trade ID. It must not submit entry/current prices, score, P&L, or immutable snapshots. The server continues to obtain and validate live market state, persist immutable entry evidence, and scope every record by authenticated owner.

### Asset Intelligence

Asset Intelligence remains one server-built response. It includes canonical score/explanation, technical matrix, chart source data, market regime, risk/context, freshness, provenance, and explicit unavailable states. No future client recalculates an authoritative score or substitutes unavailable provider data.

### Research Lab

Research experiments, configuration, dataset version/provenance, methodology, results, segments, and exports remain user-scoped API/database records. Calculations remain server-side. A durable queue is not part of Phase 1; a future queue must expose execution state through the same server contract.

## Future PWA and Tauri Integration

Phase 2 PWA work will add a manifest, icons, safe-area validation, a versioned Service Worker, an offline shell, cache invalidation, safe logout cache clearing, stale-data labeling, and Web Push only after explicit approval. It must not cache protected mutations, create/close paper trades offline, or display cached market data as live.[3]

Phase 3 Tauri work will consume `VITE_API_BASE_URL` and the same contract metadata. Its initial model is a bundled, least-privilege client using external-browser OIDC/PKCE; it receives no arbitrary filesystem, shell, database, provider credential, local trading database, or scoring-engine permission. Tauri capabilities and signed updater configuration will be separately approved and implemented later.[4] [5]

## Implemented Now vs Later

| Implemented in Phase 1 | Explicitly deferred |
|---|---|
| Configurable API-origin resolver with same-origin default | PWA manifest, Service Worker, offline cache, Web Push. |
| `/api/v1/trpc` compatibility alias and public contract metadata | Tauri/Electron project, Windows installer, signing, updater. |
| AuthAdapter/Manus adapter and OIDC/PKCE primitives/readiness state | OIDC provider selection, credentials, callback migration, token rotation/revocation. |
| Scheduler/Storage/Notification adapter interfaces with active Manus adapters | External scheduler, S3 migration, email/Web Push/native delivery. |
| Portable error categories and server-authority feature contracts | Infrastructure, hosting, database, or provider migration. |

## References

[1]: https://www.rfc-editor.org/rfc/rfc9700.html "RFC 9700: Best Current Practice for OAuth 2.0 Security"
[2]: https://www.rfc-editor.org/rfc/rfc8252.html "RFC 8252: OAuth 2.0 for Native Apps"
[3]: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation "MDN: Offline and Background Operation"
[4]: https://v2.tauri.app/security/capabilities/ "Tauri Capabilities"
[5]: https://v2.tauri.app/plugin/updater/ "Tauri Updater"
