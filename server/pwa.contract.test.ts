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
    expect(html).toContain("crypto-hub-pwa-r2-20260825");
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

  it("registers service workers without cache reuse and presents a controlled update action", () => {
    const status = read("client/src/pwa/PwaStatus.tsx");
    expect(status).toContain('register("/sw.js", { scope: "/", updateViaCache: "none" })');
    expect(status).toContain("UPDATE READY");
    expect(status).toContain("Reload to update");
    expect(status).toContain("OFFLINE · READ ONLY");
    expect(status).toContain("LIVE DATA UNAVAILABLE");
  });

  it("blocks offline account/trading writes and clearly preserves Paper Trading as online-only", () => {
    const main = read("client/src/main.tsx");
    const paper = read("client/src/components/crypto/PaperTradingWorkspace.tsx");
    expect(main).toContain('Offline read-only mode blocks account and trading changes.');
    expect(paper).toContain("Paper Trading requires a live connection to Crypto Hub.");
    expect(paper).toContain("disabled={pending || asset.asset.price === null || !online}");
    expect(paper).toContain("disabled={closing || !online}");
    expect(paper).toContain("Close unavailable offline");
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

  it("applies safe-area and full-screen mobile dialog rules without introducing a native wrapper", () => {
    const css = read("client/src/index.css");
    const manifest = read("client/public/manifest.webmanifest");
    expect(css).toContain("env(safe-area-inset-top)");
    expect(css).toContain('[data-slot="dialog-content"]');
    expect(css).toContain("height: 100dvh !important");
    expect(manifest).not.toContain("tauri");
    expect(manifest).not.toContain("electron");
  });
});
