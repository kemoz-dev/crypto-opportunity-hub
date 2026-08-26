CREATE TABLE `setupMonitorEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instanceId` int NOT NULL,
	`eventKey` varchar(160) NOT NULL,
	`eventType` varchar(40) NOT NULL,
	`reason` text NOT NULL,
	`relevantPrice` double,
	`relevantTimeframe` varchar(12),
	`provider` varchar(96),
	`provenance` json,
	`freshness` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `setupMonitorEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `setup_monitor_event_instance_key_unique` UNIQUE(`instanceId`,`eventKey`)
);
--> statement-breakpoint
CREATE TABLE `setupMonitorInstances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`setupType` varchar(32) NOT NULL,
	`timeframe` varchar(12) NOT NULL,
	`immutableCreationSnapshot` json NOT NULL,
	`originalStatus` varchar(32) NOT NULL,
	`originalReadinessSnapshot` json,
	`originalOpportunitySnapshot` json,
	`originalTechnicalEvidence` json,
	`originalEntryZone` json,
	`originalStopLoss` double,
	`originalTargets` json,
	`originalInvalidationCondition` json,
	`originalProviderProvenance` json,
	`currentStatus` varchar(32) NOT NULL,
	`currentReadinessSnapshot` json,
	`currentPrice` double,
	`currentTechnicalState` json,
	`currentProviderProvenance` json,
	`currentStateReason` text,
	`lastValidatedAt` timestamp,
	`terminalAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `setupMonitorInstances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `setupMonitorEvents` ADD CONSTRAINT `setupMonitorEvents_instanceId_setupMonitorInstances_id_fk` FOREIGN KEY (`instanceId`) REFERENCES `setupMonitorInstances`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `setupMonitorInstances` ADD CONSTRAINT `setupMonitorInstances_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `setupMonitorInstances` ADD CONSTRAINT `setupMonitorInstances_assetId_assets_id_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `setup_monitor_event_instance_time_idx` ON `setupMonitorEvents` (`instanceId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `setup_monitor_user_status_idx` ON `setupMonitorInstances` (`userId`,`currentStatus`);--> statement-breakpoint
CREATE INDEX `setup_monitor_user_updated_idx` ON `setupMonitorInstances` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `setup_monitor_asset_time_idx` ON `setupMonitorInstances` (`assetId`,`createdAt`);