CREATE TABLE `autoPaperEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trialId` int NOT NULL,
	`eventKey` varchar(160) NOT NULL,
	`eventType` varchar(48) NOT NULL,
	`reason` text NOT NULL,
	`price` double,
	`timeframe` varchar(12),
	`provider` varchar(96),
	`freshness` varchar(32),
	`provenance` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `autoPaperEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `auto_paper_event_trial_key_unique` UNIQUE(`trialId`,`eventKey`)
);
--> statement-breakpoint
CREATE TABLE `autoPaperSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`mode` enum('CONSERVATIVE','BALANCED','OPPORTUNITY','CUSTOM') NOT NULL DEFAULT 'BALANCED',
	`maxPositions` int NOT NULL DEFAULT 1,
	`minSetupQuality` double NOT NULL DEFAULT 70,
	`minRewardRisk` double NOT NULL DEFAULT 1.5,
	`strategies` json NOT NULL,
	`directions` json NOT NULL,
	`allowPotential` boolean NOT NULL DEFAULT false,
	`riskPercent` double NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `autoPaperSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `auto_paper_settings_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `autoPaperTrials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`paperTradeId` int NOT NULL,
	`setupIdentity` varchar(192) NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`direction` enum('long','short') NOT NULL,
	`strategy` varchar(64) NOT NULL,
	`timeframe` varchar(12) NOT NULL,
	`source` varchar(32) NOT NULL DEFAULT 'AUTO_PAPER',
	`status` enum('OPEN','HEALTHY','TARGET_1_REACHED','TARGET_2_REACHED','TARGET_3_REACHED','WARNING','REVERSAL_RISK','INVALIDATED','CLOSED','DATA_UNAVAILABLE') NOT NULL DEFAULT 'OPEN',
	`immutablePlanSnapshot` json NOT NULL,
	`immutableEntrySnapshot` json NOT NULL,
	`currentSnapshot` json,
	`entryPrice` double NOT NULL,
	`stopPrice` double NOT NULL,
	`target1` double,
	`target2` double,
	`target3` double,
	`setupQuality` double NOT NULL,
	`rewardRisk` double NOT NULL,
	`provider` varchar(96) NOT NULL,
	`provenance` json NOT NULL,
	`freshness` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp,
	CONSTRAINT `autoPaperTrials_id` PRIMARY KEY(`id`),
	CONSTRAINT `auto_paper_trial_identity_unique` UNIQUE(`userId`,`setupIdentity`)
);
--> statement-breakpoint
ALTER TABLE `autoPaperEvents` ADD CONSTRAINT `autoPaperEvents_trialId_autoPaperTrials_id_fk` FOREIGN KEY (`trialId`) REFERENCES `autoPaperTrials`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `autoPaperSettings` ADD CONSTRAINT `autoPaperSettings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `autoPaperTrials` ADD CONSTRAINT `autoPaperTrials_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `autoPaperTrials` ADD CONSTRAINT `autoPaperTrials_paperTradeId_paperTrades_id_fk` FOREIGN KEY (`paperTradeId`) REFERENCES `paperTrades`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `autoPaperTrials` ADD CONSTRAINT `autoPaperTrials_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auto_paper_event_trial_time_idx` ON `autoPaperEvents` (`trialId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `auto_paper_trial_user_status_idx` ON `autoPaperTrials` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `auto_paper_trial_asset_time_idx` ON `autoPaperTrials` (`assetId`,`createdAt`);