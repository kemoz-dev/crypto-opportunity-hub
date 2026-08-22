import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { buildLiveScanner } from "../crypto/marketService";
import { getUserScoringConfig, saveUserScoringConfig, scoringConfigSchema } from "../crypto/settings";
import { closeLivePaperTrade, getPaperPortfolio, openLivePaperTrade } from "../crypto/paperTrading";
import { runAndPersistBacktest } from "../crypto/backtesting";
import { alertInputSchema, createAlert, evaluateAlert, getAlertExecution, listAlertExecutions, listAlerts, setAlertEnabled } from "../crypto/alerts";
import { getLatestResearchReport } from "../crypto/researchSummary";
import { exportResearchExperiment, getResearchExperiment, listResearchExperiments, runResearchExperiment } from "../crypto/researchLab";
import { listHistoricalDataQuality, listHistoricalDatasets } from "../crypto/historicalData";
import { calculateResearchCosts, reconstructState } from "../crypto/reconstruction";
import { getHistoricalUniverseSnapshot, getMarketCoverageMatrix, listMarketUniverseRegistry } from "../crypto/marketUniverse";
import { listHistoricalIngestionHealth } from "../crypto/ingestionObservability";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "../../shared/const";

export const cryptoRouter = router({
  scanner: publicProcedure.input(z.object({ forceRefresh: z.boolean().optional() }).optional()).query(async ({ input, ctx }) => {
    const configuration = ctx.user ? await getUserScoringConfig(ctx.user.id) : undefined;
    return buildLiveScanner(input?.forceRefresh ?? false, configuration);
  }),
  researchSummary: publicProcedure.query(() => getLatestResearchReport()),
  researchExperiments: protectedProcedure.query(({ ctx }) => listResearchExperiments(ctx.user.id)),
  researchExperiment: protectedProcedure.input(z.object({ experimentId: z.number().int().positive() })).query(({ ctx, input }) => getResearchExperiment(ctx.user.id, input.experimentId)),
  historicalDatasets: protectedProcedure.query(() => listHistoricalDatasets()),
  historicalDataQuality: protectedProcedure.input(z.object({ datasetId: z.number().int().positive().optional() }).optional()).query(({ input }) => listHistoricalDataQuality(input?.datasetId)),
  marketUniverse: protectedProcedure.query(() => listMarketUniverseRegistry()),
  historicalUniverseSnapshot: protectedProcedure.input(z.object({ datasetId: z.number().int().positive() })).query(({ input }) => getHistoricalUniverseSnapshot(input.datasetId)),
  marketCoverageMatrix: protectedProcedure.input(z.object({ datasetId: z.number().int().positive() })).query(({ input }) => getMarketCoverageMatrix(input.datasetId)),
  historicalIngestionHealth: protectedProcedure.query(() => listHistoricalIngestionHealth()),
  reconstructHistoricalState: protectedProcedure.input(z.object({ datasetId: z.number().int().positive(), assetId: z.string().min(1), timeframe: z.enum(["15m", "1h", "4h", "1d"]), timestamp: z.number().int().positive(), instrumentType: z.enum(["spot", "perpetual"]) })).query(async ({ ctx, input }) => reconstructState(input.assetId, input.timeframe, input.timestamp, input.datasetId, input.instrumentType, await getUserScoringConfig(ctx.user.id))),
  previewResearchCosts: protectedProcedure.input(z.object({ grossReturnPercent: z.number(), instrumentType: z.enum(["spot", "perpetual"]), feePercent: z.number().min(0).max(10), slippagePercent: z.number().min(0).max(10), fundingMode: z.enum(["ACTUAL", "ASSUMED", "EXCLUDED", "UNAVAILABLE"]), fundingPercent: z.number().optional() })).query(({ input }) => calculateResearchCosts(input.grossReturnPercent, { version: "RESEARCH_COST_MODEL_V1", instrumentType: input.instrumentType, feePercent: input.feePercent, slippagePercent: input.slippagePercent, funding: { mode: input.fundingMode, percent: input.fundingPercent ?? null } })),
  runResearchExperiment: protectedProcedure.input(z.object({ name: z.string().trim().min(3).max(128), experimentId: z.enum(["A", "B", "C", "D", "E"]), assetIds: z.array(z.string().min(1)).max(12).default([]), timeframe: z.enum(["15m", "1h", "4h", "1d"]), candleLimit: z.number().int().min(250).max(1_000), startAt: z.number().optional(), endAt: z.number().optional(), minimumOpportunity: z.number().min(0).max(100), minimumConfidence: z.number().min(0).max(100), sector: z.string().max(64).optional(), regime: z.enum(["ALL", "RISK ON", "SELECTIVE", "RISK OFF"]).optional(), holdingBars: z.number().int().min(1).max(100), riskPercent: z.number().min(0.1).max(5), stopAtrMultiplier: z.number().min(0.25).max(10), takeProfitRule: z.enum(["risk-reward", "holding-close"]), targetRiskReward: z.number().min(0.25).max(20), trainPercent: z.number().int().min(50).max(90), datasetReference: z.object({ datasetId: z.number().int().positive(), datasetVersion: z.string().min(1).max(96), datasetFingerprint: z.string().min(1).max(128) }).optional(), modelVersion: z.string().min(1).max(96).optional(), instrumentType: z.enum(["spot", "perpetual"]).optional(), costModel: z.object({ version: z.string().min(1).max(96), treatment: z.enum(["GROSS_ONLY", "DECLARED_NET"]), feePercent: z.number().min(0).max(10).optional(), slippagePercent: z.number().min(0).max(10).optional(), fundingMode: z.enum(["ACTUAL", "ASSUMED", "EXCLUDED", "UNAVAILABLE"]).optional() }).optional() })).mutation(async ({ ctx, input }) => runResearchExperiment(ctx.user.id, input, await getUserScoringConfig(ctx.user.id))),
  exportResearchExperiment: protectedProcedure.input(z.object({ experimentId: z.number().int().positive(), format: z.enum(["json", "csv"]) })).query(({ ctx, input }) => exportResearchExperiment(ctx.user.id, input.experimentId, input.format)),
  settings: protectedProcedure.query(({ ctx }) => getUserScoringConfig(ctx.user.id)),
  saveSettings: protectedProcedure.input(scoringConfigSchema).mutation(({ ctx, input }) => saveUserScoringConfig(ctx.user.id, input)),
  paperPortfolio: protectedProcedure.query(async ({ ctx }) => getPaperPortfolio(ctx.user.id, await getUserScoringConfig(ctx.user.id))),
  openPaperTrade: protectedProcedure.input(z.object({ assetId: z.string().min(1), side: z.enum(["long", "short"]), riskPercent: z.number().min(0.1).max(5) })).mutation(async ({ ctx, input }) => openLivePaperTrade(ctx.user.id, input.assetId, input.side, input.riskPercent, await getUserScoringConfig(ctx.user.id))),
  closePaperTrade: protectedProcedure.input(z.object({ tradeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => closeLivePaperTrade(ctx.user.id, input.tradeId, await getUserScoringConfig(ctx.user.id))),
  runBacktest: protectedProcedure.input(z.object({ assetId: z.string().min(1), timeframe: z.enum(["15m", "1h", "4h", "1d"]), minimumScore: z.number().min(0).max(100), minimumConfidence: z.number().min(0).max(100), holdingBars: z.number().int().min(1).max(100), riskPercent: z.number().min(0.1).max(5), maximumConcurrent: z.number().int().min(1).max(20), entryRule: z.enum(["bullish", "bullish-volume"]), stopRule: z.enum(["atr", "percent"]), stopAtrMultiplier: z.number().min(0.25).max(10), stopPercent: z.number().min(0.1).max(50), takeProfitRule: z.enum(["risk-reward", "holding-close"]), targetRiskReward: z.number().min(0.25).max(20), candleLimit: z.number().int().min(250).max(1_000), startAt: z.number().optional(), endAt: z.number().optional() })).mutation(async ({ ctx, input }) => runAndPersistBacktest(ctx.user.id, input, await getUserScoringConfig(ctx.user.id))),
  alerts: protectedProcedure.query(({ ctx }) => listAlerts(ctx.user.id)),
  alertExecutions: protectedProcedure.input(z.object({ alertId: z.number().int().positive() })).query(({ ctx, input }) => listAlertExecutions(ctx.user.id, input.alertId)),
  alertExecution: protectedProcedure.input(z.object({ alertId: z.number().int().positive(), executionId: z.number().int().positive() })).query(({ ctx, input }) => getAlertExecution(ctx.user.id, input.alertId, input.executionId)),
  createAlert: protectedProcedure.input(alertInputSchema).mutation(({ ctx, input }) => createAlert(ctx.user.id, input, parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "")),
  setAlertEnabled: protectedProcedure.input(z.object({ alertId: z.number().int().positive(), enabled: z.boolean() })).mutation(({ ctx, input }) => setAlertEnabled(ctx.user.id, input.alertId, input.enabled, parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "")),
  evaluateAlert: protectedProcedure.input(z.object({ alertId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const alert = (await listAlerts(ctx.user.id)).find(item => item.id === input.alertId); if (!alert) throw new Error("Alert not found."); return evaluateAlert(input.alertId); }),
});
