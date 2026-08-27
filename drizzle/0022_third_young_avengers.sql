CREATE TABLE `autoPaperEquitySnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`userId` int NOT NULL,
	`capturedAt` timestamp NOT NULL,
	`equity` double NOT NULL,
	`availableCash` double NOT NULL,
	`realizedPnl` double NOT NULL,
	`unrealizedPnl` double NOT NULL,
	`exposure` double NOT NULL,
	`activeTrialCount` int NOT NULL,
	`provenance` json,
	`freshness` varchar(32),
	`deduplicationKey` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `autoPaperEquitySnapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `auto_paper_equity_snapshot_dedup_unique` UNIQUE(`accountId`,`deduplicationKey`)
);
--> statement-breakpoint
ALTER TABLE `autoPaperEquitySnapshots` ADD CONSTRAINT `autoPaperEquitySnapshots_accountId_autoPaperAccounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `autoPaperAccounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `autoPaperEquitySnapshots` ADD CONSTRAINT `autoPaperEquitySnapshots_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auto_paper_equity_snapshot_user_time_idx` ON `autoPaperEquitySnapshots` (`userId`,`capturedAt`);--> statement-breakpoint
CREATE INDEX `auto_paper_equity_snapshot_account_time_idx` ON `autoPaperEquitySnapshots` (`accountId`,`capturedAt`);