import { z } from "zod";
import { adminProcedure, router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { buildLiveScanner } from "../crypto/marketService";
import { addUserWatchlistAsset, getUserScoringConfig, getUserWatchlist, removeUserWatchlistAsset, saveUserScoringConfig, scoringConfigSchema } from "../crypto/settings";
import { closeLivePaperTrade, getPaperPortfolio, getPaperTradingSummary, openLivePaperTrade, recordPaperTradeMonitoring, refreshLowTimeframePaperTradeHealth } from "../crypto/paperTrading";
import { runAndPersistBacktest } from "../crypto/backtesting";
import { alertInputSchema, createAlert, evaluateAlert, getAlertExecution, listAlertExecutions, listAlerts, setAlertEnabled } from "../crypto/alerts";
import { getLatestResearchReport } from "../crypto/researchSummary";
import { exportResearchExperiment, getResearchExperiment, listResearchExperiments, runResearchExperiment } from "../crypto/researchLab";
import { listHistoricalDataQuality, listHistoricalDatasets } from "../crypto/historicalData";
import { calculateResearchCosts, reconstructState } from "../crypto/reconstruction";
import { getHistoricalUniverseSnapshot, getMarketCoverageMatrix, listMarketUniverseRegistry } from "../crypto/marketUniverse";
import { listHistoricalIngestionHealth } from "../crypto/ingestionObservability";
import { createExecutionCostStudy, exportExecutionCostStudy, getExecutionCostStudy, listExecutionCostStudies, previewExecutionCostStudy } from "../crypto/executionCostStudies";
import { createDisasterRecoveryArchive, getDisasterRecoveryArchive, getDisasterRecoveryArchiveDownload, getVerifiedPrimaryDisasterRecoveryArchive, getVerifiedPrimaryDisasterRecoveryArchiveDownload, listDisasterRecoveryArchives } from "../crypto/disasterRecovery";
import { getProviderMonitorSummary, listProviderMonitorHistory } from "../crypto/providerMonitor";
import { getAssetIntelligence } from "../crypto/assetIntelligence";
import { getTradeSetups } from "../crypto/tradeSetup";
import { getLowTimeframeScalpingIntelligence } from "../crypto/lowTimeframeScalping";
import { autoPaperSettingsSchema, evaluateAndCreateAutoPaperTrial, getAutoPaperAccount, getAutoPaperActive, buildAutoPaperReport, getAutoPaperEquityCurve, getAutoPaperEquityHistory, getAutoPaperEquitySnapshots, getAutoPaperEquitySummary, getAutoPaperEventFeed, getAutoPaperEvents, getAutoPaperHistory, getAutoPaperPerformance, getAutoPaperSettings, recordAutoPaperEvent, refreshAutoPaperActive, refreshAutoPaperForAllEnabled, saveAutoPaperSettings } from "../crypto/autoPaper";
import { archiveSetupMonitor, createSetupMonitor, getSetupMonitorDetail, listActiveSetupMonitors, listSetupMonitorHistory, refreshSetupMonitor } from "../crypto/setupMonitor";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "../../shared/const";
import { DEFAULT_SCORING_CONFIG } from "../../shared/crypto";

const autoPaperDateFilterSchema = z.object({ strategy: z.string().max(64).optional(), timeframe: z.string().max(12).optional(), direction: z.enum(["long", "short"]).optional(), mode: z.string().max(24).optional(), assetId: z.string().max(96).optional(), regime: z.string().max(32).optional(), status: z.string().max(32).optional(), qualification: z.string().max(32).optional(), from: z.number().int().positive().optional(), to: z.number().int().positive().optional() }).superRefine((value, context) => { if (value.from != null && value.to != null && value.from > value.to) context.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "Date range end must be on or after start." }); if (value.from != null && value.to != null && value.to - value.from > 366 * 24 * 60 * 60 * 1000) context.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "Date range cannot exceed 366 days." }); });

const executionCostStudyInputSchema = z.object({
  name: z.string().trim().min(3).max(128),
  datasetId: z.number().int().positive(),
  assetId: z.string().min(1).max(96),
  timeframe: z.enum(["15m", "1h", "4h", "1d"]),
  instrumentType: z.enum(["spot", "perpetual"]),
  side: z.enum(["long", "short"]),
  entryAt: z.number().int().positive(),
  exitAt: z.number().int().positive(),
  tradeSizeUsd: z.number().positive().max(100_000_000),
  fee: z.object({ entryKind: z.enum(["maker", "taker"]), entryPercent: z.number().min(0).max(10), exitKind: z.enum(["maker", "taker"]), exitPercent: z.number().min(0).max(10), source: z.string().trim().min(1).max(128) }),
  slippage: z.object({ entryBps: z.number().min(0).max(10_000), exitBps: z.number().min(0).max(10_000), source: z.string().trim().min(1).max(128) }),
  liquidityImpact: z.object({ enabled: z.boolean(), lookbackHours: z.number().int().min(1).max(168), participationCoefficient: z.number().min(0).max(1_000), capBps: z.number().min(0).max(10_000), source: z.string().trim().min(1).max(128) }),
  funding: z.object({ mode: z.enum(["ACTUAL", "ASSUMED", "EXCLUDED", "UNAVAILABLE"]), assumedPercent: z.number().min(-100).max(100).nullable().optional(), source: z.string().trim().max(128).nullable().optional() }),
});

export const cryptoRouter = router({
  scanner: publicProcedure.input(z.object({ forceRefresh: z.boolean().optional() }).optional()).query(async ({ input, ctx }) => {
    const configuration = ctx.user ? await getUserScoringConfig(ctx.user.id) : undefined;
    return buildLiveScanner(input?.forceRefresh ?? false, configuration);
  }),
  tradeSetups: publicProcedure.input(z.object({ mode: z.enum(["SCALP", "SWING"]) })).query(async ({ ctx, input }) => getTradeSetups(input.mode, ctx.user ? await getUserScoringConfig(ctx.user.id) : DEFAULT_SCORING_CONFIG)),
  lowTimeframeScalping: publicProcedure.input(z.object({ assetIds: z.array(z.string().min(1).max(96)).max(12).optional() }).optional()).query(async ({ ctx, input }) => getLowTimeframeScalpingIntelligence(ctx.user ? await getUserScoringConfig(ctx.user.id) : DEFAULT_SCORING_CONFIG, input?.assetIds)),
  setupMonitorActive: protectedProcedure.query(({ ctx }) => listActiveSetupMonitors(ctx.user.id)),
  setupMonitorHistory: protectedProcedure.query(({ ctx }) => listSetupMonitorHistory(ctx.user.id)),
  setupMonitorDetail: protectedProcedure.input(z.object({ instanceId: z.number().int().positive() })).query(({ ctx, input }) => getSetupMonitorDetail(ctx.user.id, input.instanceId)),
  createSetupMonitor: protectedProcedure.input(z.object({ assetId: z.string().min(1).max(96), mode: z.enum(["SCALP", "SWING"]) })).mutation(async ({ ctx, input }) => createSetupMonitor(ctx.user.id, input.assetId, input.mode, await getUserScoringConfig(ctx.user.id))),
  refreshSetupMonitor: protectedProcedure.input(z.object({ instanceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => refreshSetupMonitor(ctx.user.id, input.instanceId, await getUserScoringConfig(ctx.user.id))),
  archiveSetupMonitor: protectedProcedure.input(z.object({ instanceId: z.number().int().positive() })).mutation(({ ctx, input }) => archiveSetupMonitor(ctx.user.id, input.instanceId)),
  assetIntelligence: publicProcedure.input(z.object({ assetId: z.string().min(1), timeframe: z.enum(["15m", "1h", "4h", "1d"]).default("4h") })).query(async ({ ctx, input }) => getAssetIntelligence(input.assetId, input.timeframe, ctx.user ? await getUserScoringConfig(ctx.user.id) : undefined)),
  providerMonitorSummary: publicProcedure.query(() => getProviderMonitorSummary()),
  providerMonitorHistory: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional()).query(({ input }) => listProviderMonitorHistory(input?.limit ?? 20)),
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
  executionCostStudies: protectedProcedure.query(({ ctx }) => listExecutionCostStudies(ctx.user.id)),
  executionCostStudy: protectedProcedure.input(z.object({ studyId: z.number().int().positive() })).query(({ ctx, input }) => getExecutionCostStudy(ctx.user.id, input.studyId)),
  previewExecutionCostStudy: protectedProcedure.input(executionCostStudyInputSchema).query(({ input }) => previewExecutionCostStudy(input)),
  createExecutionCostStudy: protectedProcedure.input(executionCostStudyInputSchema).mutation(({ ctx, input }) => createExecutionCostStudy(ctx.user.id, input)),
  exportExecutionCostStudy: protectedProcedure.input(z.object({ studyId: z.number().int().positive(), format: z.enum(["json", "csv"]) })).query(({ ctx, input }) => exportExecutionCostStudy(ctx.user.id, input.studyId, input.format)),
  disasterRecoveryArchives: protectedProcedure.query(({ ctx }) => listDisasterRecoveryArchives(ctx.user.id)),
  disasterRecoveryArchive: protectedProcedure.input(z.object({ archiveId: z.number().int().positive() })).query(({ ctx, input }) => getDisasterRecoveryArchive(ctx.user.id, input.archiveId)),
  verifiedPrimaryRecoveryArchive: protectedProcedure.query(({ ctx }) => getVerifiedPrimaryDisasterRecoveryArchive(ctx.user.id)),
  createDisasterRecoveryArchive: protectedProcedure.mutation(({ ctx }) => createDisasterRecoveryArchive(ctx.user.id)),
  disasterRecoveryArchiveDownload: protectedProcedure.input(z.object({ archiveId: z.number().int().positive() })).mutation(({ ctx, input }) => getDisasterRecoveryArchiveDownload(ctx.user.id, input.archiveId)),
  downloadVerifiedPrimaryRecoveryArchive: protectedProcedure.mutation(({ ctx }) => getVerifiedPrimaryDisasterRecoveryArchiveDownload(ctx.user.id)),
  runResearchExperiment: protectedProcedure.input(z.object({ name: z.string().trim().min(3).max(128), experimentId: z.enum(["A", "B", "C", "D", "E"]), assetIds: z.array(z.string().min(1)).max(12).default([]), timeframe: z.enum(["15m", "1h", "4h", "1d"]), candleLimit: z.number().int().min(250).max(1_000), startAt: z.number().optional(), endAt: z.number().optional(), minimumOpportunity: z.number().min(0).max(100), minimumConfidence: z.number().min(0).max(100), sector: z.string().max(64).optional(), regime: z.enum(["ALL", "RISK ON", "SELECTIVE", "RISK OFF"]).optional(), holdingBars: z.number().int().min(1).max(100), riskPercent: z.number().min(0.1).max(5), stopAtrMultiplier: z.number().min(0.25).max(10), takeProfitRule: z.enum(["risk-reward", "holding-close"]), targetRiskReward: z.number().min(0.25).max(20), trainPercent: z.number().int().min(50).max(90), datasetReference: z.object({ datasetId: z.number().int().positive(), datasetVersion: z.string().min(1).max(96), datasetFingerprint: z.string().min(1).max(128) }).optional(), modelVersion: z.string().min(1).max(96).optional(), instrumentType: z.enum(["spot", "perpetual"]).optional(), costModel: z.object({ version: z.string().min(1).max(96), treatment: z.enum(["GROSS_ONLY", "DECLARED_NET"]), feePercent: z.number().min(0).max(10).optional(), slippagePercent: z.number().min(0).max(10).optional(), fundingMode: z.enum(["ACTUAL", "ASSUMED", "EXCLUDED", "UNAVAILABLE"]).optional() }).optional() })).mutation(async ({ ctx, input }) => runResearchExperiment(ctx.user.id, input, await getUserScoringConfig(ctx.user.id))),
  exportResearchExperiment: protectedProcedure.input(z.object({ experimentId: z.number().int().positive(), format: z.enum(["json", "csv"]) })).query(({ ctx, input }) => exportResearchExperiment(ctx.user.id, input.experimentId, input.format)),
  settings: protectedProcedure.query(({ ctx }) => getUserScoringConfig(ctx.user.id)),
  saveSettings: protectedProcedure.input(scoringConfigSchema).mutation(({ ctx, input }) => saveUserScoringConfig(ctx.user.id, input)),
  paperPortfolio: protectedProcedure.query(async ({ ctx }) => getPaperPortfolio(ctx.user.id, await getUserScoringConfig(ctx.user.id))),
  paperTradingSummary: protectedProcedure.query(async ({ ctx }) => getPaperTradingSummary(ctx.user.id, await getUserScoringConfig(ctx.user.id))),
  autoPaperSettings: protectedProcedure.query(({ ctx }) => getAutoPaperSettings(ctx.user.id)),
  autoPaperAccount: protectedProcedure.query(({ ctx }) => getAutoPaperAccount(ctx.user.id)),
  saveAutoPaperSettings: protectedProcedure.input(autoPaperSettingsSchema).mutation(async ({ ctx, input }) => saveAutoPaperSettings(ctx.user.id, input, (await getUserScoringConfig(ctx.user.id)).paperCapital)),
  evaluateAutoPaperTrial: protectedProcedure.input(z.object({ assetId: z.string().min(1).max(96), mode: z.enum(["SCALP", "SWING"]) })).mutation(async ({ ctx, input }) => evaluateAndCreateAutoPaperTrial(ctx.user.id, input.assetId, input.mode, await getUserScoringConfig(ctx.user.id))),
  autoPaperActive: protectedProcedure.query(({ ctx }) => getAutoPaperActive(ctx.user.id)),
  refreshAutoPaperActive: protectedProcedure.mutation(async ({ ctx }) => refreshAutoPaperActive(ctx.user.id, await getUserScoringConfig(ctx.user.id))),
  autoPaperHistory: protectedProcedure.query(({ ctx }) => getAutoPaperHistory(ctx.user.id)),
  autoPaperEvents: protectedProcedure.input(z.object({ trialId: z.number().int().positive() })).query(({ ctx, input }) => getAutoPaperEvents(ctx.user.id, input.trialId)),
  autoPaperFeed: protectedProcedure.query(({ ctx }) => getAutoPaperEventFeed(ctx.user.id)),
  autoPaperPerformance: protectedProcedure.input(autoPaperDateFilterSchema.optional()).query(({ ctx, input }) => getAutoPaperPerformance(ctx.user.id, input)),
  autoPaperEquityCurve: protectedProcedure.input(autoPaperDateFilterSchema.optional()).query(({ ctx, input }) => getAutoPaperEquityCurve(ctx.user.id, input)),
  autoPaperEquitySnapshots: protectedProcedure.input(z.object({ from: z.number().int().positive().optional(), to: z.number().int().positive().optional() }).superRefine((value, context) => { if (value.from != null && value.to != null && value.from > value.to) context.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "Date range end must be on or after start." }); if (value.from != null && value.to != null && value.to - value.from > 366 * 24 * 60 * 60 * 1000) context.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "Date range cannot exceed 366 days." }); }).optional()).query(({ ctx, input }) => getAutoPaperEquitySnapshots(ctx.user.id, input?.from, input?.to)),
  autoPaperEquityHistory: protectedProcedure.input(z.object({ from: z.number().int().positive().optional(), to: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => getAutoPaperEquityHistory(ctx.user.id, input?.from, input?.to)),
  autoPaperEquitySummary: protectedProcedure.input(z.object({ from: z.number().int().positive().optional(), to: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => getAutoPaperEquitySummary(ctx.user.id, input?.from, input?.to)),
  autoPaperExport: protectedProcedure.input(z.object({ format: z.enum(["json", "csv"]), filters: autoPaperDateFilterSchema.optional() })).query(({ ctx, input }) => buildAutoPaperReport(ctx.user.id, input.filters)),
  recordAutoPaperEvent: protectedProcedure.input(z.object({ trialId: z.number().int().positive(), eventKey: z.string().min(1).max(160), eventType: z.string().min(1).max(48), reason: z.string().min(1).max(2000), price: z.number().nullable().optional(), timeframe: z.string().max(12).nullable().optional(), provider: z.string().max(96).nullable().optional(), freshness: z.string().max(32).nullable().optional(), provenance: z.unknown().optional() })).mutation(({ ctx, input }) => recordAutoPaperEvent(ctx.user.id, input.trialId, input)),
  watchlist: protectedProcedure.query(({ ctx }) => getUserWatchlist(ctx.user.id)),
  addWatchlistAsset: protectedProcedure.input(z.object({ assetId: z.string().trim().min(1).max(96) })).mutation(({ ctx, input }) => addUserWatchlistAsset(ctx.user.id, input.assetId)),
  removeWatchlistAsset: protectedProcedure.input(z.object({ assetId: z.string().trim().min(1).max(96) })).mutation(({ ctx, input }) => removeUserWatchlistAsset(ctx.user.id, input.assetId)),
  openPaperTrade: protectedProcedure.input(z.object({ assetId: z.string().min(1), side: z.enum(["long", "short"]), riskPercent: z.number().min(0.1).max(5), setupMode: z.enum(["SCALP", "SWING", "LOW_TIMEFRAME_SCALPING"]).optional() })).mutation(async ({ ctx, input }) => openLivePaperTrade(ctx.user.id, input.assetId, input.side, input.riskPercent, await getUserScoringConfig(ctx.user.id), input.setupMode)),
  closePaperTrade: protectedProcedure.input(z.object({ tradeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => closeLivePaperTrade(ctx.user.id, input.tradeId, await getUserScoringConfig(ctx.user.id))),
  recordPaperTradeMonitoring: protectedProcedure.input(z.object({ tradeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => recordPaperTradeMonitoring(ctx.user.id, input.tradeId, await getUserScoringConfig(ctx.user.id))),
  refreshLowTimeframePaperTradeHealth: protectedProcedure.input(z.object({ tradeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => refreshLowTimeframePaperTradeHealth(ctx.user.id, input.tradeId, await getUserScoringConfig(ctx.user.id))),
  runBacktest: protectedProcedure.input(z.object({ assetId: z.string().min(1), timeframe: z.enum(["15m", "1h", "4h", "1d"]), minimumScore: z.number().min(0).max(100), minimumConfidence: z.number().min(0).max(100), holdingBars: z.number().int().min(1).max(100), riskPercent: z.number().min(0.1).max(5), maximumConcurrent: z.number().int().min(1).max(20), entryRule: z.enum(["bullish", "bullish-volume"]), stopRule: z.enum(["atr", "percent"]), stopAtrMultiplier: z.number().min(0.25).max(10), stopPercent: z.number().min(0.1).max(50), takeProfitRule: z.enum(["risk-reward", "holding-close"]), targetRiskReward: z.number().min(0.25).max(20), candleLimit: z.number().int().min(250).max(1_000), startAt: z.number().optional(), endAt: z.number().optional() })).mutation(async ({ ctx, input }) => runAndPersistBacktest(ctx.user.id, input, await getUserScoringConfig(ctx.user.id))),
  alerts: protectedProcedure.query(({ ctx }) => listAlerts(ctx.user.id)),
  alertExecutions: protectedProcedure.input(z.object({ alertId: z.number().int().positive() })).query(({ ctx, input }) => listAlertExecutions(ctx.user.id, input.alertId)),
  alertExecution: protectedProcedure.input(z.object({ alertId: z.number().int().positive(), executionId: z.number().int().positive() })).query(({ ctx, input }) => getAlertExecution(ctx.user.id, input.alertId, input.executionId)),
  createAlert: protectedProcedure.input(alertInputSchema).mutation(({ ctx, input }) => createAlert(ctx.user.id, input, parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "")),
  setAlertEnabled: protectedProcedure.input(z.object({ alertId: z.number().int().positive(), enabled: z.boolean() })).mutation(({ ctx, input }) => setAlertEnabled(ctx.user.id, input.alertId, input.enabled, parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "")),
  evaluateAlert: protectedProcedure.input(z.object({ alertId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const alert = (await listAlerts(ctx.user.id)).find(item => item.id === input.alertId); if (!alert) throw new Error("Alert not found."); return evaluateAlert(input.alertId); }),
});
