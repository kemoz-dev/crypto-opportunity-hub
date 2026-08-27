import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Phase 26 production readiness contracts", () => {
  it("normalizes canonical asset routes and supports direct, refresh, back, and forward navigation", () => {
    const app = source("client/src/App.tsx");
    const home = source("client/src/pages/Home.tsx");
    expect(app).toContain('path="/asset/:assetId"');
    expect(home).toContain("function canonicalAssetId");
    expect(home).toContain("DEFAULT_ASSET_UNIVERSE.find");
    expect(home).toContain("window.history.pushState");
    expect(home).toContain("window.addEventListener(\"popstate\"");
    expect(home).toContain("initialAssetWorkspaceOpen");
    expect(home).toContain("/asset/${encodeURIComponent(canonicalId)}");
  });

  it("handles known identity outages and unknown assets without provider requests or fabricated numbers", () => {
    const home = source("client/src/pages/Home.tsx");
    const panel = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    expect(home).toContain("identityFallbackRow");
    expect(home).toContain("price: null");
    expect(home).toContain('provider: \"UNAVAILABLE\"');
    expect(home).toContain("DEFAULT_ASSET_UNIVERSE.some(asset => asset.id === selectedId)");
    expect(panel).toContain("routeAssetKnown");
    expect(panel).toContain("No provider request was made for this unknown asset.");
    expect(panel).toContain("ASSET NOT FOUND");
    expect(panel).toContain("DATA UNAVAILABLE");
  });

  it("keeps mobile data status and last validation server-derived and separate from network state", () => {
    const server = source("server/crypto/assetIntelligence.ts");
    const panel = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    const pwa = source("client/src/pwa/PwaStatus.tsx");
    expect(server).toContain("const dataStatus = presentationState");
    expect(server).toContain("dataStatus,");
    expect(server).toContain("lastValidatedAt: sourceTimestamp");
    expect(panel).toContain("DATA STATUS ·");
    expect(panel).toContain("Last validated:");
    expect(panel).toContain("NETWORK CONNECTED");
    expect(panel).toContain("OFFLINE · READ ONLY");
    expect(pwa).toContain("liveDataAvailable");
    expect(pwa).toContain("markLiveDataUnavailable");
  });

  it("keeps chart and plan outages explicit and prevents invalid overlays", () => {
    const server = source("server/crypto/assetIntelligence.ts");
    const panel = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    const chart = source("client/src/components/crypto/InteractiveCandlestickChart.tsx");
    const css = source("client/src/index.css");
    expect(server).toContain("chartReason");
    expect(server).toContain('status: \"UNAVAILABLE\" as const');
    expect(panel).toContain("InteractiveCandlestickChart");
    expect(panel).toContain("TRADE PLAN UNAVAILABLE");
    expect(panel).toContain('plan.availability === "UNAVAILABLE"');
    expect(panel).toContain('plan.availability === "UNAVAILABLE" || !plan.entryZone');
    expect(chart).toContain("ChartAvailability");
    expect(chart).toContain("CHART DATA UNAVAILABLE");
    expect(chart).toContain("Provider:");
    expect(chart).toContain("Timeframe:");
    expect(chart).toContain("Reason:");
    expect(panel).toContain("dataset.assetWorkspaceOpen");
    expect(panel).toContain("z-[1000]");
    expect(css).toContain('html[data-asset-workspace-open="true"] .pwa-mobile-nav');
  });

  it("keeps Auto Paper observable but OFF-by-default and mutation-free during QA", () => {
    const panel = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    const router = source("server/crypto/autoPaper.ts");
    expect(panel).toContain("AUTO PAPER OFF");
    expect(panel).toContain("SIMULATION NOT RUNNING");
    expect(panel).toContain("enabled={autoPaperSettings.data?.enabled}");
    expect(panel).toContain("SERVER EVENTS");
    expect(panel).toContain("SAMPLE:");
    expect(panel).toContain("NO COMPLETED TRIALS");
    expect(panel).not.toMatch(/(create|save|mutate|refreshAutoPaper)(AutoPaper|Trial)/i);
    expect(router).not.toMatch(/placeOrder|submitOrder|createRealOrder|exchange\.createOrder/i);
  });

  it("preserves protected Auto Paper endpoints and static-shell-only PWA caching", () => {
    const router = source("server/routers/crypto.ts");
    const pwa = source("client/src/pwa/PwaStatus.tsx");
    const worker = source("client/public/sw.js");
    expect(router).toContain("protectedProcedure");
    expect(router).toContain("autoPaperAccount");
    expect(router).toContain("autoPaperPerformance");
    expect(router).toContain("ctx.user");
    expect(worker).toContain("isApiRequest(url)");
    expect(worker).toContain("if (url.origin !== self.location.origin || isApiRequest(url)) return;");
    expect(worker).toContain('request.mode === "navigate"');
    expect(worker).toContain("isImmutableAsset");
  });
});
