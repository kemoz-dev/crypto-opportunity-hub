CREATE TABLE `historicalAssetAvailability` (
	`id` int AUTO_INCREMENT NOT NULL,
	`datasetId` int NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`listingAt` timestamp,
	`delistingAt` timestamp,
	`availability` enum('AVAILABLE','UNAVAILABLE') NOT NULL,
	`source` varchar(128) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalAssetAvailability_id` PRIMARY KEY(`id`),
	CONSTRAINT `historical_asset_availability_dataset_asset_unique` UNIQUE(`datasetId`,`assetId`)
);
--> statement-breakpoint
CREATE TABLE `historicalCandles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ingestionRunId` int NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`exchange` varchar(64) NOT NULL,
	`provider` varchar(96) NOT NULL,
	`instrumentType` enum('spot','perpetual') NOT NULL,
	`timeframe` enum('15m','1h','4h','1d') NOT NULL,
	`sourceOpenTimeMs` bigint NOT NULL,
	`sourceCloseTimeMs` bigint NOT NULL,
	`open` double NOT NULL,
	`high` double NOT NULL,
	`low` double NOT NULL,
	`close` double NOT NULL,
	`volume` double NOT NULL,
	`sourceHash` varchar(128) NOT NULL,
	`sourcePayload` json,
	`ingestedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalCandles_id` PRIMARY KEY(`id`),
	CONSTRAINT `historical_candle_revision_unique` UNIQUE(`assetId`,`exchange`,`instrumentType`,`timeframe`,`sourceOpenTimeMs`,`sourceHash`)
);
--> statement-breakpoint
CREATE TABLE `historicalDataQuality` (
	`id` int AUTO_INCREMENT NOT NULL,
	`datasetId` int NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`exchange` varchar(64) NOT NULL,
	`provider` varchar(96) NOT NULL,
	`instrumentType` enum('spot','perpetual') NOT NULL,
	`timeframe` enum('15m','1h','4h','1d') NOT NULL,
	`status` enum('COMPLETE','PARTIAL','MISSING','STALE','ERROR') NOT NULL,
	`earliestCandleAt` timestamp,
	`latestCandleAt` timestamp,
	`expectedCandleCount` int NOT NULL DEFAULT 0,
	`actualCandleCount` int NOT NULL DEFAULT 0,
	`missingIntervalCount` int NOT NULL DEFAULT 0,
	`duplicateCount` int NOT NULL DEFAULT 0,
	`malformedCount` int NOT NULL DEFAULT 0,
	`lastSuccessfulIngestionAt` timestamp,
	`lastIngestionRunId` int,
	`freshnessThresholdMs` bigint NOT NULL,
	`details` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalDataQuality_id` PRIMARY KEY(`id`),
	CONSTRAINT `historical_quality_dataset_scope_unique` UNIQUE(`datasetId`,`assetId`,`exchange`,`instrumentType`,`timeframe`)
);
--> statement-breakpoint
CREATE TABLE `historicalDatasets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` varchar(96) NOT NULL,
	`status` enum('building','sealed','failed') NOT NULL,
	`protocolVersion` varchar(64) NOT NULL,
	`basedOnDatasetId` int,
	`ingestionCutoffAt` timestamp NOT NULL,
	`providerManifest` json NOT NULL,
	`coverageManifest` json NOT NULL,
	`contentFingerprint` varchar(128),
	`notes` text,
	`sealedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalDatasets_id` PRIMARY KEY(`id`),
	CONSTRAINT `historical_datasets_version_unique` UNIQUE(`version`)
);
--> statement-breakpoint
CREATE TABLE `historicalIngestionRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` varchar(96) NOT NULL,
	`datasetId` int,
	`runKind` enum('backfill','incremental','quality_recheck') NOT NULL,
	`status` enum('running','completed','partial','failed') NOT NULL,
	`provider` varchar(96) NOT NULL,
	`exchange` varchar(64) NOT NULL,
	`instrumentType` enum('spot','perpetual') NOT NULL,
	`assetId` varchar(96),
	`timeframes` json NOT NULL,
	`requestedStartAt` timestamp,
	`requestedEndAt` timestamp,
	`sourceStartAt` timestamp,
	`sourceEndAt` timestamp,
	`insertedCount` int NOT NULL DEFAULT 0,
	`duplicateCount` int NOT NULL DEFAULT 0,
	`malformedCount` int NOT NULL DEFAULT 0,
	`missingIntervalCount` int NOT NULL DEFAULT 0,
	`providerError` text,
	`details` json NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalIngestionRuns_id` PRIMARY KEY(`id`),
	CONSTRAINT `historical_ingestion_batch_unique` UNIQUE(`batchId`)
);
--> statement-breakpoint
CREATE TABLE `historicalMarketCaps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`datasetId` int NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`provider` varchar(96) NOT NULL,
	`sourceObservedAt` timestamp NOT NULL,
	`marketCap` double,
	`circulatingSupply` double,
	`availability` enum('AVAILABLE','UNAVAILABLE','APPROXIMATION') NOT NULL,
	`retrievalAt` timestamp NOT NULL DEFAULT (now()),
	`sourcePayload` json,
	CONSTRAINT `historicalMarketCaps_id` PRIMARY KEY(`id`),
	CONSTRAINT `historical_market_cap_dataset_asset_provider_time_unique` UNIQUE(`datasetId`,`assetId`,`provider`,`sourceObservedAt`)
);
--> statement-breakpoint
CREATE TABLE `historicalMissingIntervals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`datasetId` int NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`exchange` varchar(64) NOT NULL,
	`instrumentType` enum('spot','perpetual') NOT NULL,
	`timeframe` enum('15m','1h','4h','1d') NOT NULL,
	`gapStartMs` bigint NOT NULL,
	`gapEndMs` bigint NOT NULL,
	`expectedMissingCount` int NOT NULL,
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalMissingIntervals_id` PRIMARY KEY(`id`),
	CONSTRAINT `historical_gap_scope_unique` UNIQUE(`datasetId`,`assetId`,`exchange`,`instrumentType`,`timeframe`,`gapStartMs`)
);
--> statement-breakpoint
CREATE TABLE `historicalRegimeSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`datasetId` int NOT NULL,
	`timeframe` enum('15m','1h','4h','1d') NOT NULL,
	`observedAt` timestamp NOT NULL,
	`classification` enum('RISK ON','SELECTIVE','RISK OFF','UNAVAILABLE') NOT NULL,
	`regimeScore` double,
	`inputs` json NOT NULL,
	`definitionVersion` varchar(64) NOT NULL,
	`availability` enum('AVAILABLE','UNAVAILABLE') NOT NULL,
	`source` varchar(128) NOT NULL,
	`freshnessAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalRegimeSnapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `historical_regime_dataset_timeframe_time_unique` UNIQUE(`datasetId`,`timeframe`,`observedAt`)
);
--> statement-breakpoint
CREATE TABLE `historicalSectorSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`datasetId` int NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`observedAt` timestamp NOT NULL,
	`sector` varchar(96),
	`sectorMomentum` double,
	`sectorRank` int,
	`relativeStrengthVsSector` double,
	`relativeStrengthVsBtc` double,
	`definitionVersion` varchar(64) NOT NULL,
	`availability` enum('AVAILABLE','UNAVAILABLE') NOT NULL,
	`source` varchar(128) NOT NULL,
	`freshnessAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalSectorSnapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `historical_sector_dataset_asset_time_unique` UNIQUE(`datasetId`,`assetId`,`observedAt`)
);
--> statement-breakpoint
ALTER TABLE `historicalAssetAvailability` ADD CONSTRAINT `historicalAssetAvailability_datasetId_historicalDatasets_id_fk` FOREIGN KEY (`datasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalAssetAvailability` ADD CONSTRAINT `historicalAssetAvailability_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalCandles` ADD CONSTRAINT `historicalCandles_ingestionRunId_historicalIngestionRuns_id_fk` FOREIGN KEY (`ingestionRunId`) REFERENCES `historicalIngestionRuns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalCandles` ADD CONSTRAINT `historicalCandles_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalDataQuality` ADD CONSTRAINT `historicalDataQuality_datasetId_historicalDatasets_id_fk` FOREIGN KEY (`datasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalDataQuality` ADD CONSTRAINT `historicalDataQuality_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalDataQuality` ADD CONSTRAINT `hist_q_last_batch_fk` FOREIGN KEY (`lastIngestionRunId`) REFERENCES `historicalIngestionRuns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalIngestionRuns` ADD CONSTRAINT `hist_ingest_dataset_fk` FOREIGN KEY (`datasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalIngestionRuns` ADD CONSTRAINT `hist_ingest_asset_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalMarketCaps` ADD CONSTRAINT `hist_cap_dataset_fk` FOREIGN KEY (`datasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalMarketCaps` ADD CONSTRAINT `hist_cap_asset_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalMissingIntervals` ADD CONSTRAINT `hist_gap_dataset_fk` FOREIGN KEY (`datasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalMissingIntervals` ADD CONSTRAINT `hist_gap_asset_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalRegimeSnapshots` ADD CONSTRAINT `hist_regime_dataset_fk` FOREIGN KEY (`datasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalSectorSnapshots` ADD CONSTRAINT `hist_sector_dataset_fk` FOREIGN KEY (`datasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalSectorSnapshots` ADD CONSTRAINT `hist_sector_asset_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `historical_candle_lookup_idx` ON `historicalCandles` (`assetId`,`instrumentType`,`timeframe`,`sourceCloseTimeMs`);--> statement-breakpoint
CREATE INDEX `historical_candle_ingestion_idx` ON `historicalCandles` (`ingestionRunId`,`sourceOpenTimeMs`);--> statement-breakpoint
CREATE INDEX `historical_quality_status_idx` ON `historicalDataQuality` (`status`,`latestCandleAt`);--> statement-breakpoint
CREATE INDEX `historical_datasets_status_created_idx` ON `historicalDatasets` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `historical_ingestion_dataset_asset_idx` ON `historicalIngestionRuns` (`datasetId`,`assetId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `historical_ingestion_status_idx` ON `historicalIngestionRuns` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `historical_market_cap_lookup_idx` ON `historicalMarketCaps` (`assetId`,`sourceObservedAt`);--> statement-breakpoint
CREATE INDEX `historical_gap_dataset_idx` ON `historicalMissingIntervals` (`datasetId`,`assetId`,`timeframe`);--> statement-breakpoint
CREATE INDEX `historical_regime_lookup_idx` ON `historicalRegimeSnapshots` (`timeframe`,`observedAt`);--> statement-breakpoint
CREATE INDEX `historical_sector_lookup_idx` ON `historicalSectorSnapshots` (`assetId`,`observedAt`);
