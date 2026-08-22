CREATE TABLE `executionCostModels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`version` varchar(96) NOT NULL,
	`configurationFingerprint` varchar(128) NOT NULL,
	`configuration` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `executionCostModels_id` PRIMARY KEY(`id`),
	CONSTRAINT `execution_cost_model_user_fingerprint_unique` UNIQUE(`userId`,`configurationFingerprint`)
);
--> statement-breakpoint
CREATE TABLE `executionCostStudies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`modelId` int,
	`name` varchar(128) NOT NULL,
	`status` enum('running','completed','failed') NOT NULL,
	`datasetId` int NOT NULL,
	`datasetVersion` varchar(96) NOT NULL,
	`datasetFingerprint` varchar(128),
	`assetId` varchar(96) NOT NULL,
	`exchange` varchar(64) NOT NULL,
	`instrumentType` enum('spot','perpetual') NOT NULL,
	`timeframe` enum('15m','1h','4h','1d') NOT NULL,
	`entryAt` timestamp NOT NULL,
	`exitAt` timestamp NOT NULL,
	`tradeSizeUsd` double NOT NULL,
	`grossEntryPrice` double NOT NULL,
	`grossExitPrice` double NOT NULL,
	`grossReturnPercent` double NOT NULL,
	`configurationFingerprint` varchar(128) NOT NULL,
	`configuration` json NOT NULL,
	`dataProvenance` json NOT NULL,
	`resultSnapshot` json,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `executionCostStudies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `historicalFundingRates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`datasetId` int NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`exchange` varchar(64) NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`fundingTime` timestamp NOT NULL,
	`fundingRate` double NOT NULL,
	`markPrice` double,
	`rateType` varchar(32),
	`fundingIntervalMs` bigint,
	`intervalEvidence` varchar(64) NOT NULL,
	`dataQuality` enum('AVAILABLE','PARTIAL','UNAVAILABLE') NOT NULL,
	`source` varchar(128) NOT NULL,
	`sourcePayload` json,
	`retrievedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalFundingRates_id` PRIMARY KEY(`id`),
	CONSTRAINT `historical_funding_dataset_asset_source_time_unique` UNIQUE(`datasetId`,`assetId`,`source`,`fundingTime`)
);
--> statement-breakpoint
CREATE TABLE `historicalLiquidityObservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`datasetId` int NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`exchange` varchar(64) NOT NULL,
	`instrumentType` enum('spot','perpetual') NOT NULL,
	`timeframe` enum('15m','1h','4h','1d') NOT NULL,
	`observedAt` timestamp NOT NULL,
	`windowStartAt` timestamp,
	`windowEndAt` timestamp,
	`quoteVolume` double,
	`marketCap` double,
	`volumeMarketCapRatio` double,
	`liquidityTier` enum('A','B','C','D','E','UNAVAILABLE') NOT NULL,
	`dataQuality` enum('AVAILABLE','PARTIAL','UNAVAILABLE') NOT NULL,
	`source` varchar(128) NOT NULL,
	`evidence` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalLiquidityObservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `historical_liquidity_dataset_scope_time_unique` UNIQUE(`datasetId`,`assetId`,`exchange`,`instrumentType`,`timeframe`,`observedAt`)
);
--> statement-breakpoint
ALTER TABLE `executionCostModels` ADD CONSTRAINT `executionCostModels_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executionCostStudies` ADD CONSTRAINT `executionCostStudies_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executionCostStudies` ADD CONSTRAINT `executionCostStudies_modelId_executionCostModels_id_fk` FOREIGN KEY (`modelId`) REFERENCES `executionCostModels`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executionCostStudies` ADD CONSTRAINT `executionCostStudies_datasetId_historicalDatasets_id_fk` FOREIGN KEY (`datasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executionCostStudies` ADD CONSTRAINT `executionCostStudies_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalFundingRates` ADD CONSTRAINT `historicalFundingRates_datasetId_historicalDatasets_id_fk` FOREIGN KEY (`datasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalFundingRates` ADD CONSTRAINT `historicalFundingRates_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalLiquidityObservations` ADD CONSTRAINT `hist_liquidity_dataset_fk` FOREIGN KEY (`datasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalLiquidityObservations` ADD CONSTRAINT `hist_liquidity_asset_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `execution_cost_model_user_created_idx` ON `executionCostModels` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `execution_cost_study_user_created_idx` ON `executionCostStudies` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `execution_cost_study_dataset_asset_idx` ON `executionCostStudies` (`datasetId`,`assetId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `execution_cost_study_status_idx` ON `executionCostStudies` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `historical_funding_lookup_idx` ON `historicalFundingRates` (`datasetId`,`assetId`,`fundingTime`);--> statement-breakpoint
CREATE INDEX `historical_liquidity_dataset_asset_idx` ON `historicalLiquidityObservations` (`datasetId`,`assetId`,`createdAt`);
