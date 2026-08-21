import { boolean, double, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const assets = mysqlTable("assets", {
  id: varchar("id", { length: 96 }).primaryKey(),
  symbol: varchar("symbol", { length: 24 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  binanceSymbol: varchar("binanceSymbol", { length: 32 }).notNull(),
  sector: varchar("sector", { length: 64 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("assets_symbol_unique").on(table.symbol),
  index("assets_sector_idx").on(table.sector),
]);

export const dataSources = mysqlTable("dataSources", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 64 }).notNull(),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["live", "stale", "unavailable"]).notNull(),
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  message: text("message"),
  metadata: json("metadata"),
});

export const marketData = mysqlTable("marketData", {
  id: int("id").autoincrement().primaryKey(),
  assetId: varchar("assetId", { length: 96 }).notNull().references(() => assets.id),
  provider: varchar("provider", { length: 64 }).notNull(),
  timeframe: varchar("timeframe", { length: 12 }),
  observedAt: timestamp("observedAt").notNull(),
  open: double("open"),
  high: double("high"),
  low: double("low"),
  close: double("close"),
  volume: double("volume"),
  price: double("price"),
  marketCap: double("marketCap"),
  marketCapRank: int("marketCapRank"),
  volume24h: double("volume24h"),
  change1h: double("change1h"),
  change24h: double("change24h"),
  change7d: double("change7d"),
  fundingRate: double("fundingRate"),
  openInterest: double("openInterest"),
  rawPayload: json("rawPayload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("market_data_asset_time_idx").on(table.assetId, table.timeframe, table.observedAt),
  index("market_data_provider_time_idx").on(table.provider, table.observedAt),
]);

export const technicalSnapshots = mysqlTable("technicalSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  assetId: varchar("assetId", { length: 96 }).notNull().references(() => assets.id),
  timeframe: varchar("timeframe", { length: 12 }).notNull(),
  observedAt: timestamp("observedAt").notNull(),
  sourceObservedAt: timestamp("sourceObservedAt"),
  rsi: double("rsi"),
  macdHistogram: double("macdHistogram"),
  atrPercent: double("atrPercent"),
  volumeExpansion: double("volumeExpansion"),
  analysis: json("analysis").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("technical_snapshot_asset_time_idx").on(table.assetId, table.timeframe, table.observedAt),
]);

export const scoreSnapshots = mysqlTable("scoreSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  assetId: varchar("assetId", { length: 96 }).notNull().references(() => assets.id),
  observedAt: timestamp("observedAt").notNull(),
  opportunityScore: double("opportunityScore").notNull(),
  confidenceScore: double("confidenceScore").notNull(),
  technicalScore: double("technicalScore").notNull(),
  momentumScore: double("momentumScore").notNull(),
  sectorScore: double("sectorScore"),
  riskScore: double("riskScore").notNull(),
  setupType: varchar("setupType", { length: 64 }).notNull(),
  direction: mysqlEnum("direction", ["bullish", "neutral", "bearish"]).notNull(),
  riskLevel: mysqlEnum("riskLevel", ["low", "moderate", "high"]).notNull(),
  configurationVersion: varchar("configurationVersion", { length: 64 }).notNull(),
  components: json("components").notNull(),
  explanation: text("explanation").notNull(),
  missingConditions: json("missingConditions").notNull(),
  dataStatus: json("dataStatus").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("score_snapshot_asset_time_idx").on(table.assetId, table.observedAt),
  index("score_snapshot_rank_idx").on(table.opportunityScore, table.confidenceScore),
]);

export const sectors = mysqlTable("sectors", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull(),
  name: varchar("name", { length: 96 }).notNull(),
  modelConfiguration: json("modelConfiguration").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("sectors_slug_unique").on(table.slug)]);

export const userSettings = mysqlTable("userSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  scoringConfiguration: json("scoringConfiguration").notNull(),
  watchlist: json("watchlist"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("user_settings_user_unique").on(table.userId)]);

export const paperPortfolios = mysqlTable("paperPortfolios", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 128 }).notNull(),
  startingCapital: double("startingCapital").notNull(),
  currentEquity: double("currentEquity").notNull(),
  realizedPnl: double("realizedPnl").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("paper_portfolios_user_idx").on(table.userId)]);

export const paperTrades = mysqlTable("paperTrades", {
  id: int("id").autoincrement().primaryKey(),
  portfolioId: int("portfolioId").notNull().references(() => paperPortfolios.id, { onDelete: "cascade" }),
  assetId: varchar("assetId", { length: 96 }).notNull().references(() => assets.id),
  status: mysqlEnum("status", ["open", "closed", "cancelled"]).notNull(),
  side: mysqlEnum("side", ["long", "short"]).notNull(),
  entryAt: timestamp("entryAt").notNull(),
  entryPrice: double("entryPrice").notNull(),
  stopLoss: double("stopLoss").notNull(),
  takeProfit: json("takeProfit").notNull(),
  positionSize: double("positionSize").notNull(),
  riskPercent: double("riskPercent").notNull(),
  rewardRisk: double("rewardRisk").notNull(),
  exitAt: timestamp("exitAt"),
  exitPrice: double("exitPrice"),
  realizedPnl: double("realizedPnl"),
  immutableEntrySnapshot: json("immutableEntrySnapshot").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("paper_trades_portfolio_status_idx").on(table.portfolioId, table.status),
  index("paper_trades_asset_time_idx").on(table.assetId, table.entryAt),
]);

export const backtestRuns = mysqlTable("backtestRuns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed"]).notNull(),
  configuration: json("configuration").notNull(),
  dataCutoffAt: timestamp("dataCutoffAt").notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("backtest_runs_user_created_idx").on(table.userId, table.createdAt)]);

export const backtestResults = mysqlTable("backtestResults", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull().references(() => backtestRuns.id, { onDelete: "cascade" }),
  assetId: varchar("assetId", { length: 96 }).references(() => assets.id),
  metrics: json("metrics").notNull(),
  signalSnapshots: json("signalSnapshots").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("backtest_results_run_idx").on(table.runId)]);

export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 128 }).notNull(),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  conditions: json("conditions").notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  lastSignalSnapshot: json("lastSignalSnapshot"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("alerts_user_enabled_idx").on(table.userId, table.isEnabled), index("alerts_schedule_task_idx").on(table.scheduleCronTaskUid)]);

export const researchReports = mysqlTable("researchReports", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 128 }).notNull(),
  asOf: timestamp("asOf").notNull(),
  methodology: json("methodology").notNull(),
  report: json("report").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("research_reports_as_of_idx").on(table.asOf)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type MarketData = typeof marketData.$inferSelect;
export type TechnicalSnapshot = typeof technicalSnapshots.$inferSelect;
export type ScoreSnapshot = typeof scoreSnapshots.$inferSelect;
export type PaperTrade = typeof paperTrades.$inferSelect;
export type ResearchReport = typeof researchReports.$inferSelect;
