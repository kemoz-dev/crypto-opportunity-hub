import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { buildLiveScanner } from "../crypto/marketService";
import { getUserScoringConfig, saveUserScoringConfig, scoringConfigSchema } from "../crypto/settings";
import { closeLivePaperTrade, getPaperPortfolio, openLivePaperTrade } from "../crypto/paperTrading";
import { runAndPersistBacktest } from "../crypto/backtesting";
import { alertInputSchema, createAlert, evaluateAlert, listAlertExecutions, listAlerts, setAlertEnabled } from "../crypto/alerts";
import { getLatestResearchReport } from "../crypto/researchSummary";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "../../shared/const";

export const cryptoRouter = router({
  scanner: publicProcedure.input(z.object({ forceRefresh: z.boolean().optional() }).optional()).query(async ({ input, ctx }) => {
    const configuration = ctx.user ? await getUserScoringConfig(ctx.user.id) : undefined;
    return buildLiveScanner(input?.forceRefresh ?? false, configuration);
  }),
  researchSummary: publicProcedure.query(() => getLatestResearchReport()),
  settings: protectedProcedure.query(({ ctx }) => getUserScoringConfig(ctx.user.id)),
  saveSettings: protectedProcedure.input(scoringConfigSchema).mutation(({ ctx, input }) => saveUserScoringConfig(ctx.user.id, input)),
  paperPortfolio: protectedProcedure.query(async ({ ctx }) => getPaperPortfolio(ctx.user.id, await getUserScoringConfig(ctx.user.id))),
  openPaperTrade: protectedProcedure.input(z.object({ assetId: z.string().min(1), side: z.enum(["long", "short"]), riskPercent: z.number().min(0.1).max(5) })).mutation(async ({ ctx, input }) => openLivePaperTrade(ctx.user.id, input.assetId, input.side, input.riskPercent, await getUserScoringConfig(ctx.user.id))),
  closePaperTrade: protectedProcedure.input(z.object({ tradeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => closeLivePaperTrade(ctx.user.id, input.tradeId, await getUserScoringConfig(ctx.user.id))),
  runBacktest: protectedProcedure.input(z.object({ assetId: z.string().min(1), timeframe: z.enum(["15m", "1h", "4h", "1d"]), minimumScore: z.number().min(0).max(100), minimumConfidence: z.number().min(0).max(100), holdingBars: z.number().int().min(1).max(100), riskPercent: z.number().min(0.1).max(5), maximumConcurrent: z.number().int().min(1).max(20), entryRule: z.enum(["bullish", "bullish-volume"]), stopRule: z.enum(["atr", "percent"]), stopAtrMultiplier: z.number().min(0.25).max(10), stopPercent: z.number().min(0.1).max(50), takeProfitRule: z.enum(["risk-reward", "holding-close"]), targetRiskReward: z.number().min(0.25).max(20), candleLimit: z.number().int().min(250).max(1_000), startAt: z.number().optional(), endAt: z.number().optional() })).mutation(async ({ ctx, input }) => runAndPersistBacktest(ctx.user.id, input, await getUserScoringConfig(ctx.user.id))),
  alerts: protectedProcedure.query(({ ctx }) => listAlerts(ctx.user.id)),
  alertExecutions: protectedProcedure.input(z.object({ alertId: z.number().int().positive() })).query(({ ctx, input }) => listAlertExecutions(ctx.user.id, input.alertId)),
  createAlert: protectedProcedure.input(alertInputSchema).mutation(({ ctx, input }) => createAlert(ctx.user.id, input, parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "")),
  setAlertEnabled: protectedProcedure.input(z.object({ alertId: z.number().int().positive(), enabled: z.boolean() })).mutation(({ ctx, input }) => setAlertEnabled(ctx.user.id, input.alertId, input.enabled, parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "")),
  evaluateAlert: protectedProcedure.input(z.object({ alertId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const alert = (await listAlerts(ctx.user.id)).find(item => item.id === input.alertId); if (!alert) throw new Error("Alert not found."); return evaluateAlert(input.alertId); }),
});
