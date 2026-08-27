import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const project = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, project), "utf8");

describe("Phase 2 secure PWA contract", () => {
  it("publishes an installable standalone manifest with same-app scope", () => {
    const manifest = JSON.parse(read("client/public/manifest.webmanifest")) as Record<string, unknown>;
    expect(manifest).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone", background_color: "#060a12", theme_color: "#08101d" });
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect((manifest.icons as unknown[]).length).toBeGreaterThan(0);
  });

  it("uses Apple metadata, viewport safe-area support, and a versioned PWA marker", () => {
    const html = read("client/index.html");
    expect(html).toContain('rel="manifest"');
    expect(html).toContain("apple-mobile-web-app-capable");
    expect(html).toContain("apple-touch-icon");
    expect(html).toContain("viewport-fit=cover");
    expect(html).toContain("crypto-hub-pwa-r3-20260825");
  });

  it("keeps the service worker static-shell-only and excludes API and mutations from caches", () => {
    const worker = read("client/public/sw.js");
    expect(worker).toContain('const CACHE_NAME = `crypto-hub-shell-${BUILD_ID}`');
    expect(worker).toContain("async function precacheShell()");
    expect(worker).toContain("cache.addAll(assets)");
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('if (request.method !== "GET") return');
    expect(worker).toContain("ACTIVATE_UPDATE");
    expect(worker).toContain("caches.delete");
    expect(worker).not.toMatch(/cache\.put\([^\n]*\/api\//);
    expect(worker).not.toContain("openPaperTrade");
    expect(worker).not.toContain("closePaperTrade");
  });

  it("registers service workers without cache reuse and presents truthful connection and update states", () => {
    const status = read("client/src/pwa/PwaStatus.tsx");
    expect(status).toContain('register("/sw.js", { scope: "/", updateViaCache: "none" })');
    expect(status).toContain("UPDATE READY");
    expect(status).toContain("Reload to update");
    expect(status).toContain("OFFLINE · READ ONLY");
    expect(status).toContain("LIVE DATA UNAVAILABLE");
    expect(status).toContain('"RECONNECTING"');
    expect(status).toContain('"DATA UNAVAILABLE"');
    expect(status).toContain("markLiveDataUnavailable");
    expect(status).toContain("server-validated live-data response");
  });

  it("blocks offline account/trading writes and clearly preserves Paper Trading as online-only", () => {
    const main = read("client/src/main.tsx");
    const paper = read("client/src/components/crypto/PaperTradingWorkspace.tsx");
    const lowTimeframe = read("client/src/components/crypto/LowTimeframeScalpingWorkspace.tsx");
    expect(main).toContain('Offline read-only mode blocks account and trading changes.');
    expect(paper).toContain("Paper Trading requires a live connection to Crypto Hub.");
    expect(paper).toContain("disabled={pending || asset.asset.price === null || !online}");
    expect(paper).toContain("disabled={closing || !online}");
    expect(paper).toContain("Close unavailable offline");
    expect(paper).toContain("Refresh 1M / 3M / 5M Health");
    expect(paper).toContain("disabled={lowMonitoring || !online}");
    expect(lowTimeframe).toContain("trpc.crypto.lowTimeframeScalping.useQuery");
    expect(lowTimeframe).toContain("enabled: online");
    expect(lowTimeframe).toContain("OFFLINE · READ ONLY");
    expect(lowTimeframe).not.toContain("api.bybit.com");
    expect(lowTimeframe).not.toContain("fetch(");
  });

  it("keeps Phase 8 discovery server-derived, mobile-accessible, and qualified-only for Paper Trading", () => {
    const discovery = read("client/src/components/crypto/OpportunityDiscoveryWorkspace.tsx");
    const asset = read("client/src/components/crypto/AssetIntelligencePanel.tsx");
    const paper = read("client/src/components/crypto/PaperTradingWorkspace.tsx");
    const mobile = read("client/src/pwa/PwaMobileNavigation.tsx");
    const serverPaper = read("server/crypto/paperTrading.ts");
    expect(discovery).toContain("trpc.crypto.tradeSetups.useQuery({ mode: \"SWING\" }");
    expect(discovery).toContain("enabled: online");
    expect(discovery).not.toContain("fetch(");
    expect(discovery).not.toContain("api.bybit.com");
    expect(discovery).toContain("DATA UNAVAILABLE");
    expect(asset).toContain("Setup plan · validated Swing evidence");
    expect(asset).toContain("Paper trade qualified Swing");
    expect(paper).toContain("No qualified paper-trade setup selected");
    expect(serverPaper).toContain("assertQualifiedPaperTradeContext(setupMode)");
    expect(mobile).toContain('label: "Discovery"');
  });

  it("keeps Phase 9 readiness and conditional plans server-derived, non-actionable, and low-timeframe-safe", () => {
    const discovery = read("client/src/components/crypto/OpportunityDiscoveryWorkspace.tsx");
    const swing = read("client/src/components/crypto/TradeSetupWorkspace.tsx");
    const lowTimeframe = read("client/src/components/crypto/LowTimeframeScalpingWorkspace.tsx");
    expect(discovery).toContain("setupReadiness");
    expect(discovery).toContain("potentialAlertEligible");
    expect(discovery).toContain("Conditional technical plan — not a trade instruction");
    expect(discovery).toContain("WAITING CONFIRMATION");
    expect(discovery).toContain("REVERSAL RISK");
    expect(discovery).not.toContain("api.bybit.com");
    expect(discovery).not.toContain("fetch(");
    expect(swing).toContain("Conditional technical plan — not eligible for Paper Trading");
    expect(lowTimeframe).toContain("Scalping Intelligence data is unavailable.");
    expect(lowTimeframe).toContain("No fallback, fabricated, resampled, stale, or mixed-provider setup is shown.");
    expect(lowTimeframe).not.toContain("15M / 1H / 4H");
  });

  it("keeps Phase 10B Setup Monitor authenticated, server-derived, and offline-safe", () => {
    const monitor = read("client/src/components/crypto/SetupMonitorWorkspace.tsx");
    const navigation = read("client/src/pwa/PwaMobileNavigation.tsx");
    const home = read("client/src/pages/Home.tsx");
    const service = read("server/crypto/setupMonitor.ts");
    expect(monitor).toContain("trpc.crypto.setupMonitorActive.useQuery");
    expect(monitor).toContain("enabled: online");
    expect(monitor).toContain("disabled={!online");
    expect(monitor).toContain("Monitoring refresh, archive, and event writes are disabled offline");
    expect(monitor).not.toContain("api.bybit.com");
    expect(monitor).not.toContain("fetch(\"https://api");
    expect(navigation).toContain('label: "Setup Monitor"');
    expect(home).toContain('workspace=setup-monitor');
    expect(service).toContain("eq(setupMonitorInstances.userId, userId)");
    expect(service).toContain('event.key');
    expect(service).toContain('currentStatus === "ARCHIVED"');
    expect(service).toContain("progressPercent");
    expect(service).toContain("currentSnapshot: snapshot");
    expect(monitor).toContain("Health");
    expect(monitor).toContain("Trade plan");
    expect(monitor).toContain("Server-derived evidence");
  });

  it("keeps Phase 13 Paper Trading summary read-only, Watchlist owner-scoped, and workspaces lazy-loaded", () => {
    const summary = read("client/src/components/crypto/PaperTradingSummaryCard.tsx");
    const watchlist = read("client/src/components/crypto/WatchlistWorkspace.tsx");
    const settings = read("server/crypto/settings.ts");
    const paper = read("server/crypto/paperTrading.ts");
    const router = read("server/routers/crypto.ts");
    const home = read("client/src/pages/Home.tsx");
    const mobile = read("client/src/pwa/PwaMobileNavigation.tsx");
    const vite = read("vite.config.ts");
    expect(summary).toContain("paperTradingSummary.useQuery");
    expect(summary).toContain("No trade or portfolio mutation occurs here");
    expect(summary).toContain("enabled: online && isAuthenticated");
    expect(watchlist).toContain("trpc.crypto.watchlist.useQuery");
    expect(watchlist).toContain("trpc.crypto.addWatchlistAsset.useMutation");
    expect(watchlist).toContain("trpc.crypto.removeWatchlistAsset.useMutation");
    expect(watchlist).toContain("disabled={!online}");
    expect(settings).toContain("userSettings.watchlist");
    expect(settings).toContain("assertCanonicalAsset");
    expect(paper).toContain("Read-only dashboard summary");
    expect(paper).toContain("if (!portfolio) return { portfolio: null");
    expect(router).toContain("paperTradingSummary: protectedProcedure.query");
    expect(router).toContain("watchlist: protectedProcedure.query");
    expect(router).toContain("addWatchlistAsset: protectedProcedure");
    expect(router).toContain("removeWatchlistAsset: protectedProcedure");
    expect(home).toContain("LazyWatchlistWorkspace");
    expect(home).toContain("LazyPaperTradingWorkspace");
    expect(vite).toContain("manualChunks");
    expect(mobile).toContain('label: "Watchlist"');
    for (const source of [summary, watchlist, home]) {
      expect(source).not.toContain("api.bybit.com");
      expect(source).not.toContain("fetch(\"https://api");
    }
  });

  it("keeps Phase 14 theme, evidence hierarchy, and Scalping separation presentation-only", () => {
    const theme = read("client/src/contexts/ThemeContext.tsx");
    const css = read("client/src/index.css");
    const home = read("client/src/pages/Home.tsx");
    const mobile = read("client/src/pwa/PwaMobileNavigation.tsx");
    const card = read("client/src/components/crypto/OpportunityCard.tsx");
    const trade = read("client/src/components/crypto/TradeSetupWorkspace.tsx");
    expect(theme).toContain("prefers-color-scheme");
    expect(theme).toContain("localStorage");
    expect(theme).toContain("dataset.theme");
    expect(css).toContain("prefers-reduced-motion");
    expect(home).toContain("toggleTheme");
    expect(home).toContain("Switch to");
    expect(mobile).toContain("role=\"dialog\"");
    expect(mobile).toContain("Escape");
    expect(mobile).toContain("Switch to");
    expect(card).toContain("Distance to invalidation");
    expect(card).toContain("dataQuality");
    expect(card).toContain("confirmationGaps");
    expect(trade).toContain("15M Fast Scalp");
    expect(trade).toContain("1M / 3M / 5M is isolated");
    for (const source of [home, mobile, card, trade]) {
      expect(source).not.toContain("api.bybit.com");
      expect(source).not.toContain("fetch(\"https://api");
    }
  });

  it("does not retain the client-side user mirror after logout and avoids server secret references", () => {
    const auth = read("client/src/_core/hooks/useAuth.ts");
    const pwaSources = [
      "client/public/sw.js",
      "client/src/pwa/PwaStatus.tsx",
      "client/public/manifest.webmanifest",
      "client/public/offline.html",
    ].map(read).join("\n");
    expect(auth).toContain('localStorage.removeItem("manus-runtime-user-info")');
    for (const secret of ["DATABASE_URL", "JWT_SECRET", "BUILT_IN_FORGE_API_KEY", "VITE_FRONTEND_FORGE_API_KEY", "SCHEDULER_SIGNING_KEY", "STORAGE_SIGNING_SECRET"]) {
      expect(pwaSources).not.toContain(secret);
    }
  });

  it("applies safe-area, scrollable mobile dialog, and overflow rules without introducing a native wrapper", () => {
    const css = read("client/src/index.css");
    const manifest = read("client/public/manifest.webmanifest");
    expect(css).toContain("env(safe-area-inset-top)");
    expect(css).toContain('[data-slot="dialog-content"]');
    expect(css).toContain("inset: env(safe-area-inset-top)");
    expect(css).toContain("overflow-y: auto !important");
    expect(css).toContain("overflow-x: hidden");
    expect(manifest).not.toContain("tauri");
    expect(manifest).not.toContain("electron");
  });

  it("uses an accessible primary-plus-secondary mobile navigation pattern and mobile scanner cards", () => {
    const navigation = read("client/src/pwa/PwaMobileNavigation.tsx");
    const css = read("client/src/index.css");
    const home = read("client/src/pages/Home.tsx");
    expect(navigation).toContain('label: "Scalp"');
    expect(navigation).toContain('label: "Swing"');
    expect(navigation).toContain('label: "Paper"');
    expect(navigation).toContain('id="pwa-mobile-more"');
    expect(navigation).toContain('aria-controls="pwa-mobile-more"');
    expect(css).toContain("grid-template-columns: minmax(0,1fr) max-content !important");
    expect(css).toContain("orientation: landscape");
    expect(home).toContain('document.getElementById("market-scanner")?.scrollIntoView');
    expect(home).toContain('id="market-scanner"');
    expect(home).toContain('connectionState !== "ONLINE" || updateReady');
    expect(home).toContain('pwaBannerVisible && "pt-16"');
  });

  it("keeps Phase 12 presentation grouped, reusable, and server-derived", () => {
    const home = read("client/src/pages/Home.tsx");
    const card = read("client/src/components/crypto/OpportunityCard.tsx");
    const discovery = read("client/src/components/crypto/OpportunityDiscoveryWorkspace.tsx");
    const trade = read("client/src/components/crypto/TradeSetupWorkspace.tsx");
    const asset = read("client/src/components/crypto/AssetIntelligencePanel.tsx");
    expect(home).toContain("navigationGroups");
    expect(home).toContain("Market control center");
    expect(home).toContain("server-validated evidence");
    expect(card).toContain("OpportunityCard");
    expect(card).toContain("DATA UNAVAILABLE");
    expect(card).toContain("Monitor Setup");
    expect(discovery).toContain("<OpportunityCard");
    expect(trade).toContain("<OpportunityCard");
    expect(asset).toContain("<OpportunityCard");
    for (const source of [home, card, discovery, trade, asset]) {
      expect(source).not.toContain("api.bybit.com");
      expect(source).not.toContain("fetch(\"https://api");
    }
  });
});
