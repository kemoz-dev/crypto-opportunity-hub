CREATE TABLE `historicalUniverseMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`universeSnapshotId` int NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`priorityTier` enum('TIER_1','TIER_2','TIER_3','TIER_4') NOT NULL,
	`inclusionReason` text NOT NULL,
	`registrySector` varchar(96),
	`sectorClassificationStatus` enum('REGISTRY_ONLY','HISTORICAL_UNAVAILABLE','HISTORICAL_AVAILABLE') NOT NULL,
	`availableFromAt` timestamp,
	`availableToAt` timestamp,
	`ohlcvStatus` enum('AVAILABLE','PARTIAL','MISSING','UNAVAILABLE') NOT NULL,
	`marketCapStatus` enum('AVAILABLE','PARTIAL','MISSING','UNAVAILABLE') NOT NULL,
	`dataQualityStatus` enum('HIGH','MEDIUM','LOW','UNAVAILABLE') NOT NULL,
	`qualityEvidence` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalUniverseMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `historical_universe_member_unique` UNIQUE(`universeSnapshotId`,`assetId`)
);
--> statement-breakpoint
CREATE TABLE `historicalUniverseSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`datasetId` int NOT NULL,
	`universeKind` enum('CURRENT_SURVIVOR_UNIVERSE','HISTORICAL_COVERAGE_UNIVERSE') NOT NULL,
	`selectionMethod` varchar(128) NOT NULL,
	`survivorshipWarning` text NOT NULL,
	`historicalSectorStatus` enum('AVAILABLE','UNAVAILABLE') NOT NULL,
	`assetCount` int NOT NULL DEFAULT 0,
	`sectorCount` int NOT NULL DEFAULT 0,
	`coverageSummary` json NOT NULL,
	`sourceProvenance` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalUniverseSnapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `historical_universe_dataset_unique` UNIQUE(`datasetId`)
);
--> statement-breakpoint
CREATE TABLE `marketUniverseAssets` (
	`assetId` varchar(96) NOT NULL,
	`symbol` varchar(24) NOT NULL,
	`name` varchar(128) NOT NULL,
	`coingeckoId` varchar(128),
	`exchangeIdentifiers` json NOT NULL,
	`priorityTier` enum('TIER_1','TIER_2','TIER_3','TIER_4') NOT NULL,
	`inclusionReason` text NOT NULL,
	`registrySector` varchar(96),
	`sectorClassificationStatus` enum('REGISTRY_ONLY','HISTORICAL_UNAVAILABLE','HISTORICAL_AVAILABLE') NOT NULL,
	`firstObservedAt` timestamp,
	`lastObservedAt` timestamp,
	`listingStatus` enum('ACTIVE','DELISTED','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
	`listingKnownAt` timestamp,
	`delistingKnownAt` timestamp,
	`marketCapCoverageStatus` enum('AVAILABLE','PARTIAL','MISSING','UNAVAILABLE') NOT NULL DEFAULT 'UNAVAILABLE',
	`ohlcvCoverageStatus` enum('AVAILABLE','PARTIAL','MISSING','UNAVAILABLE') NOT NULL DEFAULT 'UNAVAILABLE',
	`dataQualityStatus` enum('HIGH','MEDIUM','LOW','UNAVAILABLE') NOT NULL DEFAULT 'UNAVAILABLE',
	`sourceProvenance` json NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketUniverseAssets_assetId` PRIMARY KEY(`assetId`)
);
--> statement-breakpoint
ALTER TABLE `historicalDataQuality` ADD `coveragePercent` double DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `historicalDataQuality` ADD `longestGapMs` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `historicalDataQuality` ADD `qualityScore` double DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `historicalDataQuality` ADD `qualityRating` enum('HIGH','MEDIUM','LOW','UNAVAILABLE') DEFAULT 'UNAVAILABLE' NOT NULL;--> statement-breakpoint
ALTER TABLE `historicalUniverseMembers` ADD CONSTRAINT `hub_universe_member_snapshot_fk` FOREIGN KEY (`universeSnapshotId`) REFERENCES `historicalUniverseSnapshots`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalUniverseMembers` ADD CONSTRAINT `hub_universe_member_asset_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalUniverseSnapshots` ADD CONSTRAINT `hub_universe_snapshot_dataset_fk` FOREIGN KEY (`datasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketUniverseAssets` ADD CONSTRAINT `hub_market_universe_asset_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `historical_universe_member_asset_idx` ON `historicalUniverseMembers` (`assetId`,`priorityTier`);--> statement-breakpoint
CREATE INDEX `historical_universe_kind_idx` ON `historicalUniverseSnapshots` (`universeKind`,`createdAt`);--> statement-breakpoint
CREATE INDEX `market_universe_tier_enabled_idx` ON `marketUniverseAssets` (`priorityTier`,`isEnabled`);--> statement-breakpoint
CREATE INDEX `market_universe_sector_idx` ON `marketUniverseAssets` (`registrySector`);
