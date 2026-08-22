import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const { listMarketUniverseRegistry, getHistoricalUniverseSnapshot, getMarketCoverageMatrix, listHistoricalIngestionHealth, createAlert, saveUserScoringConfig, openLivePaperTrade, closeLivePaperTrade } = vi.hoisted(() => ({ listMarketUniverseRegistry: vi.fn(), getHistoricalUniverseSnapshot: vi.fn(), getMarketCoverageMatrix: vi.fn(), listHistoricalIngestionHealth: vi.fn(), createAlert: vi.fn(), saveUserScoringConfig: vi.fn(), openLivePaperTrade: vi.fn(), closeLivePaperTrade: vi.fn() }));
vi.mock("./crypto/marketUniverse", async importOriginal => {
  const actual = await importOriginal<typeof import("./crypto/marketUniverse")>();
  return { ...actual, listMarketUniverseRegistry, getHistoricalUniverseSnapshot, getMarketCoverageMatrix };
});
vi.mock("./crypto/alerts", async importOriginal => {
  const actual = await importOriginal<typeof import("./crypto/alerts")>();
  return { ...actual, createAlert };
});
vi.mock("./crypto/settings", async importOriginal => {
  const actual = await importOriginal<typeof import("./crypto/settings")>();
  return { ...actual, saveUserScoringConfig };
});
vi.mock("./crypto/paperTrading", async importOriginal => {
  const actual = await importOriginal<typeof import("./crypto/paperTrading")>();
  return { ...actual, openLivePaperTrade, closeLivePaperTrade };
});
vi.mock("./crypto/ingestionObservability", async importOriginal => {
  const actual = await importOriginal<typeof import("./crypto/ingestionObservability")>();
  return { ...actual, listHistoricalIngestionHealth };
});

import { appRouter } from "./routers";

function context(user: TrpcContext["user"]): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

const user = { id: 7, openId: "market-universe-user", email: null, name: "Market Universe User", loginMethod: "manus", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

describe("crypto market-universe protected routes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns immutable coverage evidence only through an authenticated caller", async () => {
    listMarketUniverseRegistry.mockResolvedValue([{ assetId: "bitcoin" }]);
    getHistoricalUniverseSnapshot.mockResolvedValue({ id: 60001, datasetId: 300001, members: [] });
    getMarketCoverageMatrix.mockResolvedValue({ datasetId: 300001, rows: [{ assetId: "bitcoin" }] });
    listHistoricalIngestionHealth.mockResolvedValue({ executions: [], readiness: { status: "ACCUMULATING" } });
    const caller = appRouter.createCaller(context(user));

    await expect(caller.crypto.marketUniverse()).resolves.toEqual([{ assetId: "bitcoin" }]);
    await expect(caller.crypto.historicalUniverseSnapshot({ datasetId: 300001 })).resolves.toMatchObject({ id: 60001 });
    await expect(caller.crypto.marketCoverageMatrix({ datasetId: 300001 })).resolves.toMatchObject({ rows: [{ assetId: "bitcoin" }] });
    await expect(caller.crypto.historicalIngestionHealth()).resolves.toMatchObject({ readiness: { status: "ACCUMULATING" } });
    expect(listMarketUniverseRegistry).toHaveBeenCalledOnce();
    expect(getHistoricalUniverseSnapshot).toHaveBeenCalledWith(300001);
    expect(getMarketCoverageMatrix).toHaveBeenCalledWith(300001);
    expect(listHistoricalIngestionHealth).toHaveBeenCalledOnce();
  });

  it("rejects unauthenticated coverage requests before any data service call", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.crypto.marketUniverse()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.crypto.historicalUniverseSnapshot({ datasetId: 300001 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.crypto.marketCoverageMatrix({ datasetId: 300001 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.crypto.historicalIngestionHealth()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(listMarketUniverseRegistry).not.toHaveBeenCalled();
    expect(getHistoricalUniverseSnapshot).not.toHaveBeenCalled();
    expect(getMarketCoverageMatrix).not.toHaveBeenCalled();
    expect(listHistoricalIngestionHealth).not.toHaveBeenCalled();
  });

  it("keeps coverage retrieval read-only and never mutates alerts, scoring settings, paper trades, or real-trading boundaries", async () => {
    listMarketUniverseRegistry.mockResolvedValue([]);
    getHistoricalUniverseSnapshot.mockResolvedValue(null);
    getMarketCoverageMatrix.mockResolvedValue({ datasetId: 300001, rows: [] });
    listHistoricalIngestionHealth.mockResolvedValue({ executions: [], readiness: { status: "NOT_READY" } });
    const caller = appRouter.createCaller(context(user));

    await caller.crypto.marketUniverse();
    await caller.crypto.historicalUniverseSnapshot({ datasetId: 300001 });
    await caller.crypto.marketCoverageMatrix({ datasetId: 300001 });
    await caller.crypto.historicalIngestionHealth();

    expect(createAlert).not.toHaveBeenCalled();
    expect(saveUserScoringConfig).not.toHaveBeenCalled();
    expect(openLivePaperTrade).not.toHaveBeenCalled();
    expect(closeLivePaperTrade).not.toHaveBeenCalled();
  });
});
