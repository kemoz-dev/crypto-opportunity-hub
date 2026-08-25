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
    expect(asset).toContain("Current setup · Swing discovery");
    expect(asset).toContain("Paper trade qualified Swing");
    expect(paper).toContain("No qualified paper-trade setup selected");
    expect(serverPaper).toContain("assertQualifiedPaperTradeContext(setupMode)");
    expect(mobile).toContain('label: "Discovery"');
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
});
