CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`conditions` json NOT NULL,
	`lastTriggeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` varchar(96) NOT NULL,
	`symbol` varchar(24) NOT NULL,
	`name` varchar(128) NOT NULL,
	`binanceSymbol` varchar(32) NOT NULL,
	`sector` varchar(64) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `assets_symbol_unique` UNIQUE(`symbol`)
);
--> statement-breakpoint
CREATE TABLE `backtestResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`assetId` varchar(96),
	`metrics` json NOT NULL,
	`signalSnapshots` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backtestResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backtestRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('queued','running','completed','failed') NOT NULL,
	`configuration` json NOT NULL,
	`dataCutoffAt` timestamp NOT NULL,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backtestRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dataSources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(64) NOT NULL,
	`endpoint` varchar(255) NOT NULL,
	`status` enum('live','stale','unavailable') NOT NULL,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	`message` text,
	`metadata` json,
	CONSTRAINT `dataSources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketData` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`timeframe` varchar(12),
	`observedAt` timestamp NOT NULL,
	`open` double,
	`high` double,
	`low` double,
	`close` double,
	`volume` double,
	`price` double,
	`marketCap` double,
	`marketCapRank` int,
	`volume24h` double,
	`change1h` double,
	`change24h` double,
	`change7d` double,
	`fundingRate` double,
	`openInterest` double,
	`rawPayload` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketData_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paperPortfolios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`startingCapital` double NOT NULL,
	`currentEquity` double NOT NULL,
	`realizedPnl` double NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paperPortfolios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paperTrades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolioId` int NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`status` enum('open','closed','cancelled') NOT NULL,
	`side` enum('long','short') NOT NULL,
	`entryAt` timestamp NOT NULL,
	`entryPrice` double NOT NULL,
	`stopLoss` double NOT NULL,
	`takeProfit` json NOT NULL,
	`positionSize` double NOT NULL,
	`riskPercent` double NOT NULL,
	`rewardRisk` double NOT NULL,
	`exitAt` timestamp,
	`exitPrice` double,
	`realizedPnl` double,
	`immutableEntrySnapshot` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paperTrades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scoreSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`observedAt` timestamp NOT NULL,
	`opportunityScore` double NOT NULL,
	`confidenceScore` double NOT NULL,
	`technicalScore` double NOT NULL,
	`momentumScore` double NOT NULL,
	`sectorScore` double,
	`riskScore` double NOT NULL,
	`setupType` varchar(64) NOT NULL,
	`direction` enum('bullish','neutral','bearish') NOT NULL,
	`riskLevel` enum('low','moderate','high') NOT NULL,
	`configurationVersion` varchar(64) NOT NULL,
	`components` json NOT NULL,
	`explanation` text NOT NULL,
	`missingConditions` json NOT NULL,
	`dataStatus` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scoreSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sectors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(96) NOT NULL,
	`modelConfiguration` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sectors_id` PRIMARY KEY(`id`),
	CONSTRAINT `sectors_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `technicalSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`timeframe` varchar(12) NOT NULL,
	`observedAt` timestamp NOT NULL,
	`sourceObservedAt` timestamp,
	`rsi` double,
	`macdHistogram` double,
	`atrPercent` double,
	`volumeExpansion` double,
	`analysis` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `technicalSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`scoringConfiguration` json NOT NULL,
	`watchlist` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_settings_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backtestResults` ADD CONSTRAINT `backtestResults_runId_backtestRuns_id_fk` FOREIGN KEY (`runId`) REFERENCES `backtestRuns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backtestResults` ADD CONSTRAINT `backtestResults_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backtestRuns` ADD CONSTRAINT `backtestRuns_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketData` ADD CONSTRAINT `marketData_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paperPortfolios` ADD CONSTRAINT `paperPortfolios_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paperTrades` ADD CONSTRAINT `paperTrades_portfolioId_paperPortfolios_id_fk` FOREIGN KEY (`portfolioId`) REFERENCES `paperPortfolios`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paperTrades` ADD CONSTRAINT `paperTrades_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scoreSnapshots` ADD CONSTRAINT `scoreSnapshots_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `technicalSnapshots` ADD CONSTRAINT `technicalSnapshots_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userSettings` ADD CONSTRAINT `userSettings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `alerts_user_enabled_idx` ON `alerts` (`userId`,`isEnabled`);--> statement-breakpoint
CREATE INDEX `assets_sector_idx` ON `assets` (`sector`);--> statement-breakpoint
CREATE INDEX `backtest_results_run_idx` ON `backtestResults` (`runId`);--> statement-breakpoint
CREATE INDEX `backtest_runs_user_created_idx` ON `backtestRuns` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `market_data_asset_time_idx` ON `marketData` (`assetId`,`timeframe`,`observedAt`);--> statement-breakpoint
CREATE INDEX `market_data_provider_time_idx` ON `marketData` (`provider`,`observedAt`);--> statement-breakpoint
CREATE INDEX `paper_portfolios_user_idx` ON `paperPortfolios` (`userId`);--> statement-breakpoint
CREATE INDEX `paper_trades_portfolio_status_idx` ON `paperTrades` (`portfolioId`,`status`);--> statement-breakpoint
CREATE INDEX `paper_trades_asset_time_idx` ON `paperTrades` (`assetId`,`entryAt`);--> statement-breakpoint
CREATE INDEX `score_snapshot_asset_time_idx` ON `scoreSnapshots` (`assetId`,`observedAt`);--> statement-breakpoint
CREATE INDEX `score_snapshot_rank_idx` ON `scoreSnapshots` (`opportunityScore`,`confidenceScore`);--> statement-breakpoint
CREATE INDEX `technical_snapshot_asset_time_idx` ON `technicalSnapshots` (`assetId`,`timeframe`,`observedAt`);