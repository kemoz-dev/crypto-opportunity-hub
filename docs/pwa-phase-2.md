# Phase 2 — Secure PWA Implementation

## Scope and build identity

Crypto Hub now exposes a **same-origin, installable PWA shell** with build identifier `crypto-hub-pwa-r2-20260825`. The normal web client and the installed PWA use the same React application, API-origin abstraction, authentication session, user account, database, and server-authoritative business services. This phase does not add Tauri, Electron, a Windows installer, a new OIDC provider, a client database, or any new market or trading authority.

The manifest defines the root start URL and root scope, standalone display, theme/background colours, and the PWA icon. It is connected from the existing HTML shell alongside iOS standalone and Apple touch-icon metadata. A web manifest supplies install metadata to supported browsers. [1]

| Surface | Phase 2 behavior | Authority |
|---|---|---|
| Browser/PWA shell | Available after a successful online load | Static client bundle only |
| Market Scanner and Asset Intelligence | Server API online; last rendered data is explicitly stale when offline | Existing server procedures |
| Paper Trading | Online only; LONG, SHORT, open, and close controls are disabled offline | Existing Paper Trading service |
| Alerts, Settings, Research Lab | Online-only writes are guarded client-side and by transport | Existing protected procedures |
| Database and user records | Never copied to a PWA database | Existing managed database |

## Cache and offline boundary

`sw.js` is versioned with the same build identifier. On installation it precaches the root shell, manifest, build information, offline explanation, icon, and hashed JavaScript/CSS assets discovered from the deployed HTML. It deletes older `crypto-hub-shell-*` caches when activated. Service workers can cache HTTP request/response pairs, which is why this implementation keeps the boundary deliberately narrow. [2]

> **No `/api/*` request is cached by the Service Worker.** Non-GET requests are ignored outright; Paper Trading, alerts, settings, Research Lab, recovery, and all other authenticated writes remain server calls and cannot be queued or replayed offline.

When connectivity is absent, the PWA shows **OFFLINE · READ ONLY**, a last-online timestamp, and **LIVE DATA UNAVAILABLE**. The application shell may reopen from cache. Any values already held in the active client session are labelled last known rather than current; the Service Worker does not create an authoritative local cache of research, prices, scores, accounts, or trades. Asset Intelligence prevents a new query while offline and labels its OHLCV status as **LAST KNOWN DATA**.

## Update behavior

The client registers the Service Worker with `updateViaCache: "none"`, asks the registration to check for an update, and presents **UPDATE READY** when a waiting worker exists. The user controls activation via **Reload to update**. The client does not call `skipWaiting()` automatically, so an active Paper Trading confirmation or Research workflow is not force-reloaded. The update uses a new versioned cache and removes old shell caches only during activation.

## Mobile, iPhone, and iPad behavior

The HTML viewport enables `viewport-fit=cover`, and standalone mode applies safe-area padding. A five-item mobile navigation bar provides Dashboard, Scanner, Paper, Alerts, and Research entry points with accessible text labels and safe-area spacing. On narrow portrait devices and iPhone landscape dimensions, substantial dialogs render as full-screen workspaces instead of centered narrow popups. Paper Trading remains its dedicated full-screen workspace and retains semantic P&L labels in addition to colour.

The existing Asset Intelligence SVG chart retains its horizontal inspection boundary for dense technical series instead of dropping candles or indicator information. Timeframe controls remain `15M`, `1H`, `4H`, and `1D`; the current engine exposes EMA20, EMA50, and EMA200, while SMA200 remains explicitly unavailable rather than being fabricated.

For iPhone or iPad installation, open the published site in Safari, choose **Share**, choose **Add to Home Screen**, open the installed application once while online, then repeat an offline shell reload. Apple documents the Add to Home Screen flow for Safari on iPhone. [3]

## Authentication and security

The PWA uses the existing Phase 1 authentication abstraction and production login. No alternative client authentication system was introduced. Logout removes the server session through the existing protected mutation, clears the preview session token, clears the local user-info mirror, invalidates `auth.me`, and leaves no authenticated API response in Service Worker cache.

The PWA sources contain no database connection strings, Forge keys, scheduler credentials, storage signing values, or provider secrets. The Service Worker scope is `/`, and only same-origin static shell resources are cached. Protected Paper Trading and recovery calls continued to reject without authentication during validation.

## Validation record

| Check | Result |
|---|---|
| Manifest / Apple metadata / icon / standalone scope | Implemented and contract-tested |
| Service Worker registration and active scope in preview | Verified in Chromium preview |
| Cache content after public API request | Verified; no `/api/*` URL appeared in `crypto-hub-shell-*` cache |
| Offline interface and Paper Trading controls | Verified by browser offline-event simulation; LONG, SHORT, and confirm controls were disabled |
| Mobile layout | Chromium responsive viewport checked at 390×844; full-screen dialog rule and bottom navigation visible |
| Real iPhone, iPad, or Safari device | **Not performed; device access was unavailable** |
| Tests / TypeScript / production build | Run before release checkpoint; results recorded in release report |

## Known limits and Phase 3 boundary

The PWA is intentionally **not a local-first trading product**. It cannot create, close, modify, or synchronise user records offline. It does not claim a live market state without the backend. Device-specific Safari installation and keyboard behavior still require a real iPhone/iPad confirmation after deployment. Tauri, a Windows installer, auto-update, native notifications, and any actual OIDC provider configuration remain out of scope for this phase.

## References

[1]: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest "MDN — Web application manifest"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers "MDN — Using Service Workers"
[3]: https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios "Apple Support — Turn a website into an app in Safari on iPhone"
