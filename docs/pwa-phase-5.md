# Phase 5 — PWA Real-Device Readiness and Browser-Class Hardening

## Scope and Boundary

Phase 5 hardens the existing web PWA for iPhone and iPad Safari installation paths without creating a native application. It does not add low timeframes, a provider, desktop wrapper, OIDC migration, real trading, automatic trading actions, Paper Trading rule changes, scoring changes, provider-policy changes, Research Lab methodology changes, or scheduled work.

| Area | Implemented behavior | Boundary retained |
|---|---|---|
| Build marker | `crypto-hub-pwa-r3-20260825` is aligned in HTML, Service Worker, build metadata, and client PWA status code. | A new Service Worker waits for the existing user-controlled activation action. |
| Connection state | `ONLINE`, `RECONNECTING`, `DATA UNAVAILABLE`, and `OFFLINE · READ ONLY` are explicit visible states. | `ONLINE` requires a server-derived scanner snapshot with at least one live input; browser network state alone is insufficient. |
| Offline mode | The shell may reload from the versioned static cache; offline mutations remain disabled. | APIs, market responses, Paper Trading data, settings, protected research, credentials, and non-GET requests are not cached. |
| Navigation | Home, Scanner, Scalping, Swing, and Paper are primary mobile destinations; Alerts and Research use an accessible More surface. | All existing workspaces remain available; no functionality is removed. |
| Mobile layouts | Scanner rows reflow into mobile cards; full-screen mobile dialogs use safe-area bounds and internal vertical scrolling. | Asset Intelligence, Paper Trading, Research, and setup interfaces remain server-data-bound. |

## Connection and Freshness Contract

The connection indicator now separates browser reachability from the authoritative application data state. An `online` browser event enters **RECONNECTING** and clears the live-data assertion until the existing scanner query returns a server timestamp and at least one `live` data-status record. A safe scanner error produces **DATA UNAVAILABLE**. A physical offline event produces **OFFLINE · READ ONLY**, retaining the existing visible warning that live data is unavailable and Paper Trading requires a live connection.

Existing provider, timestamp, timeframe, and freshness evidence remain server-supplied. Phase 5 does not infer market freshness from the client clock or construct cached current prices, targets, or Trade Health.

## Cache and Security Boundary

The Service Worker retains its static-shell-only cache. It precaches the same-origin shell, manifest, build metadata, offline page, icon, and hashed application assets. It rejects all non-GET requests, bypasses every `/api/` request, applies user-triggered `ACTIVATE_UPDATE`, and removes only older `crypto-hub-shell-*` caches after activation.

Static scans found no client-side database, session-signing, provider, scheduler, or storage secret. They also found no real-order or automatic close/reversal/trailing implementation call. Existing unauthenticated server protections and online-only Paper Trading mutation controls are unchanged.

## Browser-Class Validation

The available environment validated the responsive shell at iPhone-class portrait (`375×812`) and landscape (`812×375`) viewports and iPad-class portrait (`768×1024`) and landscape (`1024×768`) viewports. The mobile scanner reflow showed asset, price, 24H movement, Opportunity Score, setup, and confidence without page-wide horizontal overflow. The landscape and tablet layouts retained readable provider, scanner, and workspace content. The installed-app bottom navigation is fixed chrome and is not included in full-page captures by the screenshot harness; static contract coverage verifies its primary-plus-secondary structure and safe-area padding.

A local browser-class Service Worker smoke check confirmed an active controller and a successful shell reload while network emulation was disabled. Chrome DevTools network emulation did not alter `navigator.onLine`, so it could not faithfully assert the system-level offline/online events that Safari emits; the event-driven offline/reconnect UI is covered by the client contract and requires real-device follow-up.

> **REAL IOS SAFARI TESTING NOT AVAILABLE IN THIS ENVIRONMENT.** Automated/browser validation passed; physical iPhone/iPad validation remains pending. No claim is made that Add to Home Screen, standalone launch, Safari login/logout, keyboard behavior, service-worker updates, or offline reload passed on real Apple hardware.

## Installation and Physical Test Procedure

Open the published site in Safari while online, use **Share → Add to Home Screen**, launch the new Home Screen icon once online, and confirm the standalone shell starts correctly. Then open the important workspaces, close the app, disable network, relaunch, and verify the shell is available, live data is visibly unavailable, and every Paper Trading mutation and Trade Health refresh is disabled. Restore network and verify the interface moves through **RECONNECTING** before a current server-validated response shows **ONLINE**.

The physical pass should cover iPhone portrait and landscape, iPad portrait and landscape, safe-area controls, dialog scroll and close behavior, keyboard-visible forms, authentication persistence, PWA updates, charts, downloads, and accessibility labels. It must record exact device, OS, Safari version, installation state, result, and any limitation without extrapolating from Chromium.
