import { bigint, boolean, double, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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

export const researchExperiments = mysqlTable("researchExperiments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed"]).notNull(),
  protocolVersion: varchar("protocolVersion", { length: 64 }).notNull(),
  configurationFingerprint: varchar("configurationFingerprint", { length: 128 }).notNull(),
  configuration: json("configuration").notNull(),
  datasetId: int("datasetId").references(() => historicalDatasets.id),
  datasetVersion: varchar("datasetVersion", { length: 96 }),
  datasetFingerprint: varchar("datasetFingerprint", { length: 128 }),
  modelConfigurationFingerprint: varchar("modelConfigurationFingerprint", { length: 128 }),
  instrumentType: mysqlEnum("instrumentType", ["spot", "perpetual"]),
  costModel: json("costModel"),
  dataProvenance: json("dataProvenance").notNull(),
  dataStartAt: timestamp("dataStartAt"),
  dataEndAt: timestamp("dataEndAt"),
  resultSnapshot: json("resultSnapshot"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("research_experiments_user_created_idx").on(table.userId, table.createdAt), index("research_experiments_dataset_idx").on(table.datasetId, table.createdAt)]);

export const researchExperimentResults = mysqlTable("researchExperimentResults", {
  id: int("id").autoincrement().primaryKey(),
  experimentId: int("experimentId").notNull().references(() => researchExperiments.id, { onDelete: "cascade" }),
  dimension: mysqlEnum("dimension", ["aggregate", "combination", "opportunity_threshold", "confidence_threshold", "joint_threshold", "score_bucket", "confidence_bucket", "regime", "sector", "in_sample", "out_of_sample"]).notNull(),
  dimensionKey: varchar("dimensionKey", { length: 128 }).notNull(),
  signalCount: int("signalCount").notNull(),
  evidenceStatus: mysqlEnum("evidenceStatus", ["SUPPORTED", "WEAK EVIDENCE", "UNSUPPORTED", "INSUFFICIENT DATA"]).notNull(),
  metrics: json("metrics").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("research_experiment_results_experiment_dimension_idx").on(table.experimentId, table.dimension)]);

export const historicalDatasets = mysqlTable("historicalDatasets", {
  id: int("id").autoincrement().primaryKey(),
  version: varchar("version", { length: 96 }).notNull(),
  status: mysqlEnum("status", ["building", "sealed", "failed"]).notNull(),
  protocolVersion: varchar("protocolVersion", { length: 64 }).notNull(),
  basedOnDatasetId: int("basedOnDatasetId"),
  ingestionCutoffAt: timestamp("ingestionCutoffAt").notNull(),
  providerManifest: json("providerManifest").notNull(),
  coverageManifest: json("coverageManifest").notNull(),
  contentFingerprint: varchar("contentFingerprint", { length: 128 }),
  notes: text("notes"),
  sealedAt: timestamp("sealedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("historical_datasets_version_unique").on(table.version), index("historical_datasets_status_created_idx").on(table.status, table.createdAt)]);

export const historicalIngestionRuns = mysqlTable("historicalIngestionRuns", {
  id: int("id").autoincrement().primaryKey(),
  batchId: varchar("batchId", { length: 96 }).notNull(),
  datasetId: int("datasetId").references(() => historicalDatasets.id),
  scheduleExecutionId: int("scheduleExecutionId").references(() => historicalScheduleExecutions.id),
  retryAttempt: int("retryAttempt").notNull().default(0),
  runKind: mysqlEnum("runKind", ["backfill", "incremental", "quality_recheck"]).notNull(),
  status: mysqlEnum("status", ["running", "completed", "partial", "failed"]).notNull(),
  provider: varchar("provider", { length: 96 }).notNull(),
  exchange: varchar("exchange", { length: 64 }).notNull(),
  instrumentType: mysqlEnum("instrumentType", ["spot", "perpetual"]).notNull(),
  assetId: varchar("assetId", { length: 96 }).references(() => assets.id),
  timeframes: json("timeframes").notNull(),
  requestedStartAt: timestamp("requestedStartAt"),
  requestedEndAt: timestamp("requestedEndAt"),
  sourceStartAt: timestamp("sourceStartAt"),
  sourceEndAt: timestamp("sourceEndAt"),
  insertedCount: int("insertedCount").notNull().default(0),
  duplicateCount: int("duplicateCount").notNull().default(0),
  malformedCount: int("malformedCount").notNull().default(0),
  missingIntervalCount: int("missingIntervalCount").notNull().default(0),
  providerError: text("providerError"),
  details: json("details").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("historical_ingestion_batch_unique").on(table.batchId), index("historical_ingestion_dataset_asset_idx").on(table.datasetId, table.assetId, table.createdAt), index("historical_ingestion_schedule_execution_idx").on(table.scheduleExecutionId, table.createdAt), index("historical_ingestion_status_idx").on(table.status, table.createdAt)]);

export const historicalIngestionSchedules = mysqlTable("historicalIngestionSchedules", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  cronExpression: varchar("cronExpression", { length: 64 }).notNull(),
  isEnabled: boolean("isEnabled").notNull().default(true),
  configuration: json("configuration").notNull(),
  lastDatasetId: int("lastDatasetId").references(() => historicalDatasets.id),
  lastRunAt: timestamp("lastRunAt"),
  lastStatus: mysqlEnum("lastStatus", ["SUCCESS", "PARTIAL", "FAILED", "SKIPPED"]),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("historical_ingestion_schedule_name_unique").on(table.name), uniqueIndex("historical_ingestion_schedule_task_unique").on(table.scheduleCronTaskUid), index("historical_ingestion_schedule_enabled_idx").on(table.isEnabled, table.updatedAt)]);

export const historicalScheduleExecutions = mysqlTable("historicalScheduleExecutions", {
  id: int("id").autoincrement().primaryKey(),
  scheduleId: int("scheduleId").notNull().references(() => historicalIngestionSchedules.id, { onDelete: "cascade" }),
  taskUid: varchar("taskUid", { length: 65 }).notNull(),
  datasetId: int("datasetId").references(() => historicalDatasets.id),
  status: mysqlEnum("status", ["SUCCESS", "PARTIAL", "FAILED", "SKIPPED"]).notNull(),
  skipReason: varchar("skipReason", { length: 128 }),
  assetsAttempted: int("assetsAttempted").notNull().default(0),
  assetsSucceeded: int("assetsSucceeded").notNull().default(0),
  assetsFailed: int("assetsFailed").notNull().default(0),
  candlesInserted: int("candlesInserted").notNull().default(0),
  candlesSkipped: int("candlesSkipped").notNull().default(0),
  duplicatesDetected: int("duplicatesDetected").notNull().default(0),
  gapsDetected: int("gapsDetected").notNull().default(0),
  providerErrors: json("providerErrors").notNull(),
  retryCount: int("retryCount").notNull().default(0),
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt"),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("historical_schedule_execution_schedule_time_idx").on(table.scheduleId, table.createdAt), index("historical_schedule_execution_status_idx").on(table.status, table.createdAt), index("historical_schedule_execution_task_idx").on(table.taskUid, table.createdAt)]);

export const historicalIngestionIssues = mysqlTable("historicalIngestionIssues", {
  id: int("id").autoincrement().primaryKey(),
  datasetId: int("datasetId").references(() => historicalDatasets.id),
  scheduleExecutionId: int("scheduleExecutionId").references(() => historicalScheduleExecutions.id),
  ingestionRunId: int("ingestionRunId").references(() => historicalIngestionRuns.id),
  issueKind: mysqlEnum("issueKind", ["PROVIDER_FAILURE", "MISSING_RANGE", "NO_NEW_CANDLES", "SOURCE_UNAVAILABLE"]).notNull(),
  assetId: varchar("assetId", { length: 96 }).notNull().references(() => assets.id),
  exchange: varchar("exchange", { length: 64 }).notNull(),
  provider: varchar("provider", { length: 96 }).notNull(),
  instrumentType: mysqlEnum("instrumentType", ["spot", "perpetual"]).notNull(),
  timeframe: mysqlEnum("timeframe", ["15m", "1h", "4h", "1d"]).notNull(),
  expectedStartAt: timestamp("expectedStartAt"),
  expectedEndAt: timestamp("expectedEndAt"),
  actualStartAt: timestamp("actualStartAt"),
  actualEndAt: timestamp("actualEndAt"),
  missingIntervalCount: int("missingIntervalCount").notNull().default(0),
  errorReason: text("errorReason"),
  firstDetectedAt: timestamp("firstDetectedAt").notNull(),
  evidence: json("evidence").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("historical_ingestion_issue_scope_idx").on(table.assetId, table.instrumentType, table.timeframe, table.createdAt), index("historical_ingestion_issue_execution_idx").on(table.scheduleExecutionId, table.createdAt), index("historical_ingestion_issue_dataset_idx").on(table.datasetId, table.createdAt)]);

export const historicalIngestionIssueEvents = mysqlTable("historicalIngestionIssueEvents", {
  id: int("id").autoincrement().primaryKey(),
  issueId: int("issueId").notNull().references(() => historicalIngestionIssues.id, { onDelete: "cascade" }),
  scheduleExecutionId: int("scheduleExecutionId").references(() => historicalScheduleExecutions.id),
  ingestionRunId: int("ingestionRunId").references(() => historicalIngestionRuns.id),
  eventType: mysqlEnum("eventType", ["DETECTED", "RETRY_STARTED", "RETRY_SUCCEEDED", "RETRY_FAILED", "RECHECKED"]).notNull(),
  retryAttempt: int("retryAttempt").notNull().default(0),
  observedAt: timestamp("observedAt").notNull(),
  details: json("details").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("historical_issue_event_issue_time_idx").on(table.issueId, table.createdAt), index("historical_issue_event_execution_idx").on(table.scheduleExecutionId, table.createdAt)]);

export const historicalCandles = mysqlTable("historicalCandles", {
  id: int("id").autoincrement().primaryKey(),
  ingestionRunId: int("ingestionRunId").notNull().references(() => historicalIngestionRuns.id, { onDelete: "cascade" }),
  assetId: varchar("assetId", { length: 96 }).notNull().references(() => assets.id),
  exchange: varchar("exchange", { length: 64 }).notNull(),
  provider: varchar("provider", { length: 96 }).notNull(),
  instrumentType: mysqlEnum("instrumentType", ["spot", "perpetual"]).notNull(),
  timeframe: mysqlEnum("timeframe", ["15m", "1h", "4h", "1d"]).notNull(),
  sourceOpenTimeMs: bigint("sourceOpenTimeMs", { mode: "number" }).notNull(),
  sourceCloseTimeMs: bigint("sourceCloseTimeMs", { mode: "number" }).notNull(),
  open: double("open").notNull(),
  high: double("high").notNull(),
  low: double("low").notNull(),
  close: double("close").notNull(),
  volume: double("volume").notNull(),
  sourceHash: varchar("sourceHash", { length: 128 }).notNull(),
  sourcePayload: json("sourcePayload"),
  ingestedAt: timestamp("ingestedAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("historical_candle_revision_unique").on(table.assetId, table.exchange, table.instrumentType, table.timeframe, table.sourceOpenTimeMs, table.sourceHash),
  index("historical_candle_lookup_idx").on(table.assetId, table.instrumentType, table.timeframe, table.sourceCloseTimeMs),
  index("historical_candle_ingestion_idx").on(table.ingestionRunId, table.sourceOpenTimeMs),
]);

export const historicalDataQuality = mysqlTable("historicalDataQuality", {
  id: int("id").autoincrement().primaryKey(),
  datasetId: int("datasetId").notNull().references(() => historicalDatasets.id, { onDelete: "cascade" }),
  assetId: varchar("assetId", { length: 96 }).notNull().references(() => assets.id),
  exchange: varchar("exchange", { length: 64 }).notNull(),
  provider: varchar("provider", { length: 96 }).notNull(),
  instrumentType: mysqlEnum("instrumentType", ["spot", "perpetual"]).notNull(),
  timeframe: mysqlEnum("timeframe", ["15m", "1h", "4h", "1d"]).notNull(),
  status: mysqlEnum("status", ["COMPLETE", "PARTIAL", "MISSING", "STALE", "ERROR"]).notNull(),
  earliestCandleAt: timestamp("earliestCandleAt"),
  latestCandleAt: timestamp("latestCandleAt"),
  expectedCandleCount: int("expectedCandleCount").notNull().default(0),
  actualCandleCount: int("actualCandleCount").notNull().default(0),
  coveragePercent: double("coveragePercent").notNull().default(0),
  missingIntervalCount: int("missingIntervalCount").notNull().default(0),
  longestGapMs: bigint("longestGapMs", { mode: "number" }).notNull().default(0),
  duplicateCount: int("duplicateCount").notNull().default(0),
  malformedCount: int("malformedCount").notNull().default(0),
  qualityScore: double("qualityScore").notNull().default(0),
  qualityRating: mysqlEnum("qualityRating", ["HIGH", "MEDIUM", "LOW", "UNAVAILABLE"]).notNull().default("UNAVAILABLE"),
  lastSuccessfulIngestionAt: timestamp("lastSuccessfulIngestionAt"),
  lastIngestionRunId: int("lastIngestionRunId").references(() => historicalIngestionRuns.id),
  freshnessThresholdMs: bigint("freshnessThresholdMs", { mode: "number" }).notNull(),
  details: json("details").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("historical_quality_dataset_scope_unique").on(table.datasetId, table.assetId, table.exchange, table.instrumentType, table.timeframe), index("historical_quality_status_idx").on(table.status, table.latestCandleAt)]);

export const historicalMissingIntervals = mysqlTable("historicalMissingIntervals", {
  id: int("id").autoincrement().primaryKey(),
  datasetId: int("datasetId").notNull().references(() => historicalDatasets.id, { onDelete: "cascade" }),
  assetId: varchar("assetId", { length: 96 }).notNull().references(() => assets.id),
  exchange: varchar("exchange", { length: 64 }).notNull(),
  instrumentType: mysqlEnum("instrumentType", ["spot", "perpetual"]).notNull(),
  timeframe: mysqlEnum("timeframe", ["15m", "1h", "4h", "1d"]).notNull(),
  gapStartMs: bigint("gapStartMs", { mode: "number" }).notNull(),
  gapEndMs: bigint("gapEndMs", { mode: "number" }).notNull(),
  expectedMissingCount: int("expectedMissingCount").notNull(),
  detectedAt: timestamp("detectedAt").defaultNow().notNull(),
}, table => [uniqueIndex("historical_gap_scope_unique").on(table.datasetId, table.assetId, table.exchange, table.instrumentType, table.timeframe, table.gapStartMs), index("historical_gap_dataset_idx").on(table.datasetId, table.assetId, table.timeframe)]);

export const historicalMarketCaps = mysqlTable("historicalMarketCaps", {
  id: int("id").autoincrement().primaryKey(),
  datasetId: int("datasetId").notNull().references(() => historicalDatasets.id, { onDelete: "cascade" }),
  assetId: varchar("assetId", { length: 96 }).notNull().references(() => assets.id),
  provider: varchar("provider", { length: 96 }).notNull(),
  sourceObservedAt: timestamp("sourceObservedAt").notNull(),
  marketCap: double("marketCap"),
  circulatingSupply: double("circulatingSupply"),
  availability: mysqlEnum("availability", ["AVAILABLE", "UNAVAILABLE", "APPROXIMATION"]).notNull(),
  retrievalAt: timestamp("retrievalAt").defaultNow().notNull(),
  sourcePayload: json("sourcePayload"),
}, table => [uniqueIndex("historical_market_cap_dataset_asset_provider_time_unique").on(table.datasetId, table.assetId, table.provider, table.sourceObservedAt), index("historical_market_cap_lookup_idx").on(table.assetId, table.sourceObservedAt)]);

export const historicalRegimeSnapshots = mysqlTable("historicalRegimeSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  datasetId: int("datasetId").notNull().references(() => historicalDatasets.id, { onDelete: "cascade" }),
  timeframe: mysqlEnum("timeframe", ["15m", "1h", "4h", "1d"]).notNull(),
  observedAt: timestamp("observedAt").notNull(),
  classification: mysqlEnum("classification", ["RISK ON", "SELECTIVE", "RISK OFF", "UNAVAILABLE"]).notNull(),
  regimeScore: double("regimeScore"),
  inputs: json("inputs").notNull(),
  definitionVersion: varchar("definitionVersion", { length: 64 }).notNull(),
  availability: mysqlEnum("availability", ["AVAILABLE", "UNAVAILABLE"]).notNull(),
  source: varchar("source", { length: 128 }).notNull(),
  freshnessAt: timestamp("freshnessAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("historical_regime_dataset_timeframe_time_unique").on(table.datasetId, table.timeframe, table.observedAt), index("historical_regime_lookup_idx").on(table.timeframe, table.observedAt)]);

export const historicalSectorSnapshots = mysqlTable("historicalSectorSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  datasetId: int("datasetId").notNull().references(() => historicalDatasets.id, { onDelete: "cascade" }),
  assetId: varchar("assetId", { length: 96 }).notNull().references(() => assets.id),
  observedAt: timestamp("observedAt").notNull(),
  sector: varchar("sector", { length: 96 }),
  sectorMomentum: double("sectorMomentum"),
  sectorRank: int("sectorRank"),
  relativeStrengthVsSector: double("relativeStrengthVsSector"),
  relativeStrengthVsBtc: double("relativeStrengthVsBtc"),
  definitionVersion: varchar("definitionVersion", { length: 64 }).notNull(),
  availability: mysqlEnum("availability", ["AVAILABLE", "UNAVAILABLE"]).notNull(),
  source: varchar("source", { length: 128 }).notNull(),
  freshnessAt: timestamp("freshnessAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("historical_sector_dataset_asset_time_unique").on(table.datasetId, table.assetId, table.observedAt), index("historical_sector_lookup_idx").on(table.assetId, table.observedAt)]);

export const historicalAssetAvailability = mysqlTable("historicalAssetAvailability", {
  id: int("id").autoincrement().primaryKey(),
  datasetId: int("datasetId").notNull().references(() => historicalDatasets.id, { onDelete: "cascade" }),
  assetId: varchar("assetId", { length: 96 }).notNull().references(() => assets.id),
  listingAt: timestamp("listingAt"),
  delistingAt: timestamp("delistingAt"),
  availability: mysqlEnum("availability", ["AVAILABLE", "UNAVAILABLE"]).notNull(),
  source: varchar("source", { length: 128 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("historical_asset_availability_dataset_asset_unique").on(table.datasetId, table.assetId)]);

export const marketUniverseAssets = mysqlTable("marketUniverseAssets", {
  assetId: varchar("assetId", { length: 96 }).primaryKey().references(() => assets.id, { onDelete: "cascade" }),
  symbol: varchar("symbol", { length: 24 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  coingeckoId: varchar("coingeckoId", { length: 128 }),
  exchangeIdentifiers: json("exchangeIdentifiers").notNull(),
  priorityTier: mysqlEnum("priorityTier", ["TIER_1", "TIER_2", "TIER_3", "TIER_4"]).notNull(),
  inclusionReason: text("inclusionReason").notNull(),
  registrySector: varchar("registrySector", { length: 96 }),
  sectorClassificationStatus: mysqlEnum("sectorClassificationStatus", ["REGISTRY_ONLY", "HISTORICAL_UNAVAILABLE", "HISTORICAL_AVAILABLE"]).notNull(),
  firstObservedAt: timestamp("firstObservedAt"),
  lastObservedAt: timestamp("lastObservedAt"),
  listingStatus: mysqlEnum("listingStatus", ["ACTIVE", "DELISTED", "UNKNOWN"]).notNull().default("UNKNOWN"),
  listingKnownAt: timestamp("listingKnownAt"),
  delistingKnownAt: timestamp("delistingKnownAt"),
  marketCapCoverageStatus: mysqlEnum("marketCapCoverageStatus", ["AVAILABLE", "PARTIAL", "MISSING", "UNAVAILABLE"]).notNull().default("UNAVAILABLE"),
  ohlcvCoverageStatus: mysqlEnum("ohlcvCoverageStatus", ["AVAILABLE", "PARTIAL", "MISSING", "UNAVAILABLE"]).notNull().default("UNAVAILABLE"),
  dataQualityStatus: mysqlEnum("dataQualityStatus", ["HIGH", "MEDIUM", "LOW", "UNAVAILABLE"]).notNull().default("UNAVAILABLE"),
  sourceProvenance: json("sourceProvenance").notNull(),
  isEnabled: boolean("isEnabled").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("market_universe_tier_enabled_idx").on(table.priorityTier, table.isEnabled), index("market_universe_sector_idx").on(table.registrySector)]);

export const historicalUniverseSnapshots = mysqlTable("historicalUniverseSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  datasetId: int("datasetId").notNull().references(() => historicalDatasets.id, { onDelete: "cascade" }),
  universeKind: mysqlEnum("universeKind", ["CURRENT_SURVIVOR_UNIVERSE", "HISTORICAL_COVERAGE_UNIVERSE"]).notNull(),
  selectionMethod: varchar("selectionMethod", { length: 128 }).notNull(),
  survivorshipWarning: text("survivorshipWarning").notNull(),
  historicalSectorStatus: mysqlEnum("historicalSectorStatus", ["AVAILABLE", "UNAVAILABLE"]).notNull(),
  assetCount: int("assetCount").notNull().default(0),
  sectorCount: int("sectorCount").notNull().default(0),
  coverageSummary: json("coverageSummary").notNull(),
  sourceProvenance: json("sourceProvenance").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("historical_universe_dataset_unique").on(table.datasetId), index("historical_universe_kind_idx").on(table.universeKind, table.createdAt)]);

export const historicalUniverseMembers = mysqlTable("historicalUniverseMembers", {
  id: int("id").autoincrement().primaryKey(),
  universeSnapshotId: int("universeSnapshotId").notNull().references(() => historicalUniverseSnapshots.id, { onDelete: "cascade" }),
  assetId: varchar("assetId", { length: 96 }).notNull().references(() => assets.id, { onDelete: "cascade" }),
  priorityTier: mysqlEnum("priorityTier", ["TIER_1", "TIER_2", "TIER_3", "TIER_4"]).notNull(),
  inclusionReason: text("inclusionReason").notNull(),
  registrySector: varchar("registrySector", { length: 96 }),
  sectorClassificationStatus: mysqlEnum("sectorClassificationStatus", ["REGISTRY_ONLY", "HISTORICAL_UNAVAILABLE", "HISTORICAL_AVAILABLE"]).notNull(),
  availableFromAt: timestamp("availableFromAt"),
  availableToAt: timestamp("availableToAt"),
  ohlcvStatus: mysqlEnum("ohlcvStatus", ["AVAILABLE", "PARTIAL", "MISSING", "UNAVAILABLE"]).notNull(),
  marketCapStatus: mysqlEnum("marketCapStatus", ["AVAILABLE", "PARTIAL", "MISSING", "UNAVAILABLE"]).notNull(),
  dataQualityStatus: mysqlEnum("dataQualityStatus", ["HIGH", "MEDIUM", "LOW", "UNAVAILABLE"]).notNull(),
  qualityEvidence: json("qualityEvidence").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("historical_universe_member_unique").on(table.universeSnapshotId, table.assetId), index("historical_universe_member_asset_idx").on(table.assetId, table.priorityTier)]);

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

export const alertExecutions = mysqlTable("alertExecutions", {
  id: int("id").autoincrement().primaryKey(),
  alertId: int("alertId").notNull().references(() => alerts.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["completed", "failed"]).notNull(),
  outcomeStatus: mysqlEnum("outcomeStatus", ["SUCCESS", "NO_MATCH", "FAILED", "SKIPPED"]),
  executionKind: mysqlEnum("executionKind", ["scheduled", "manual"]),
  triggered: boolean("triggered").notNull().default(false),
  httpStatus: int("httpStatus"),
  durationMs: int("durationMs"),
  assetsScanned: int("assetsScanned"),
  qualifyingOpportunities: int("qualifyingOpportunities"),
  configurationVersion: varchar("configurationVersion", { length: 96 }),
  configurationFingerprint: varchar("configurationFingerprint", { length: 128 }),
  notificationStatus: mysqlEnum("notificationStatus", ["not_requested", "not_sent", "sent", "failed"]),
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt").notNull(),
  marketRegimeSnapshot: json("marketRegimeSnapshot"),
  sectorSnapshots: json("sectorSnapshots"),
  signalSnapshots: json("signalSnapshots"),
  dataProvenance: json("dataProvenance"),
  executionSnapshot: json("executionSnapshot").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("alert_executions_alert_time_idx").on(table.alertId, table.createdAt)]);

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
export type ResearchExperiment = typeof researchExperiments.$inferSelect;
export type ResearchExperimentResult = typeof researchExperimentResults.$inferSelect;
export type ResearchReport = typeof researchReports.$inferSelect;
export type AlertExecution = typeof alertExecutions.$inferSelect;
