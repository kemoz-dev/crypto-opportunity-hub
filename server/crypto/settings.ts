import { eq } from "drizzle-orm";
import { z } from "zod";
import { userSettings } from "../../drizzle/schema";
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "../../shared/crypto";
import { getDb } from "../db";

const percentage = z.number().min(0).max(100);
const timeframeSettingsSchema = z.object({
  "15m": z.object({ enabled: z.boolean(), weight: z.number().min(0).max(1) }),
  "1h": z.object({ enabled: z.boolean(), weight: z.number().min(0).max(1) }),
  "4h": z.object({ enabled: z.boolean(), weight: z.number().min(0).max(1) }),
  "1d": z.object({ enabled: z.boolean(), weight: z.number().min(0).max(1) }),
});

export const scoringConfigSchema = z.object({
  weights: z.object({
    technical: percentage,
    momentum: percentage,
    sector: percentage,
    catalyst: percentage,
    riskLiquidity: percentage,
  }).refine(value => Object.values(value).some(weight => weight > 0), "At least one score component must have a non-zero weight."),
  indicator: z.object({
    rsiPeriod: z.number().int().min(2).max(100),
    macdFast: z.number().int().min(2).max(100),
    macdSlow: z.number().int().min(3).max(200),
    macdSignal: z.number().int().min(2).max(100),
    emaFast: z.number().int().min(2).max(150),
    emaMedium: z.number().int().min(3).max(200),
    emaSlow: z.number().int().min(20).max(400),
    bollingerPeriod: z.number().int().min(5).max(100),
    atrPeriod: z.number().int().min(2).max(100),
    volumePeriod: z.number().int().min(2).max(100),
  }).refine(value => value.macdFast < value.macdSlow, "The MACD fast period must be lower than the slow period.").refine(value => value.emaFast < value.emaMedium && value.emaMedium < value.emaSlow, "EMA periods must increase from fast to medium to slow."),
  timeframes: timeframeSettingsSchema.refine(value => Object.values(value).some(item => item.enabled), "At least one timeframe must be enabled."),
  thresholds: z.object({ opportunity: percentage, confidence: percentage, technical: z.number().min(0).max(40) }),
  risk: z.object({ maxAtrPercent: z.number().positive().max(100), minimumMarketCap: z.number().nonnegative(), minimumVolumeToMarketCap: z.number().min(0).max(10) }),
  sectorModels: z.record(z.string(), z.object({ technicalMultiplier: z.number().min(0.25).max(2), riskMultiplier: z.number().min(0.25).max(2), description: z.string().min(1).max(240) })),
  paperCapital: z.number().positive().max(100_000_000),
});

export type ScoringConfigInput = z.infer<typeof scoringConfigSchema>;

function mergeWithDefaults(value: unknown): ScoringConfig {
  const parsed = scoringConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_SCORING_CONFIG;
}

export async function getUserScoringConfig(userId: number): Promise<ScoringConfig> {
  const db = await getDb();
  if (!db) return DEFAULT_SCORING_CONFIG;
  const row = (await db.select({ scoringConfiguration: userSettings.scoringConfiguration }).from(userSettings).where(eq(userSettings.userId, userId)).limit(1))[0];
  return row ? mergeWithDefaults(row.scoringConfiguration) : DEFAULT_SCORING_CONFIG;
}

export async function saveUserScoringConfig(userId: number, configuration: ScoringConfigInput): Promise<ScoringConfig> {
  const validated = scoringConfigSchema.parse(configuration);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; settings cannot be saved.");
  await db.insert(userSettings).values({ userId, scoringConfiguration: validated }).onDuplicateKeyUpdate({ set: { scoringConfiguration: validated } });
  return validated;
}
