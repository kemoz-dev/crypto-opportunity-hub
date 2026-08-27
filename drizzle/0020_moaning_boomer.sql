CREATE TABLE `autoPaperAccounts` (
		`id` int AUTO_INCREMENT NOT NULL,
		`userId` int NOT NULL,
		`name` varchar(96) NOT NULL DEFAULT 'Auto Paper Simulation',
		`startingCapital` double NOT NULL DEFAULT 10000,
		`currentEquity` double NOT NULL DEFAULT 10000,
		`availableCash` double NOT NULL DEFAULT 10000,
		`realizedPnl` double NOT NULL DEFAULT 0,
		`unrealizedPnl` double NOT NULL DEFAULT 0,
		`createdAt` timestamp NOT NULL DEFAULT (now()),
		`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
		CONSTRAINT `autoPaperAccounts_id` PRIMARY KEY(`id`),
		CONSTRAINT `auto_paper_account_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
INSERT INTO `autoPaperAccounts` (`userId`)
SELECT DISTINCT `userId` FROM `autoPaperTrials`;
--> statement-breakpoint
ALTER TABLE `autoPaperTrials` DROP FOREIGN KEY `autoPaperTrials_paperTradeId_paperTrades_id_fk`;
--> statement-breakpoint
ALTER TABLE `autoPaperSettings` MODIFY COLUMN `mode` enum('CONSERVATIVE','BALANCED','OPPORTUNITY','EXPERIMENTAL','CUSTOM') NOT NULL DEFAULT 'BALANCED';
--> statement-breakpoint
ALTER TABLE `autoPaperTrials` MODIFY COLUMN `paperTradeId` int;
--> statement-breakpoint
ALTER TABLE `autoPaperTrials` MODIFY COLUMN `status` enum('DETECTED','ENTERED','OPEN','HEALTHY','TARGET_1_REACHED','TARGET_2_REACHED','TARGET_3_REACHED','WARNING','REVERSAL_RISK','INVALIDATED','STOPPED','CLOSED','COMPLETED','DATA_UNAVAILABLE','EXPIRED') NOT NULL DEFAULT 'DETECTED';
--> statement-breakpoint
ALTER TABLE `autoPaperTrials` ADD `accountId` int NULL;
--> statement-breakpoint
UPDATE `autoPaperTrials` t INNER JOIN `autoPaperAccounts` a ON a.`userId` = t.`userId` SET t.`accountId` = a.`id` WHERE t.`accountId` IS NULL;
--> statement-breakpoint
ALTER TABLE `autoPaperTrials` MODIFY COLUMN `accountId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `autoPaperTrials` ADD `mode` enum('CONSERVATIVE','BALANCED','OPPORTUNITY','EXPERIMENTAL','CUSTOM') DEFAULT 'BALANCED' NOT NULL;
--> statement-breakpoint
ALTER TABLE `autoPaperTrials` ADD `positionSize` double DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `autoPaperTrials` ADD `riskPercent` double DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `autoPaperTrials` ADD `realizedPnl` double DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `autoPaperTrials` ADD `currentPnl` double DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `autoPaperAccounts` ADD CONSTRAINT `autoPaperAccounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `autoPaperTrials` ADD CONSTRAINT `autoPaperTrials_accountId_autoPaperAccounts_id_fk` FOREIGN KEY (`accountId`) REFERENCES `autoPaperAccounts`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `autoPaperTrials` ADD CONSTRAINT `autoPaperTrials_paperTradeId_paperTrades_id_fk` FOREIGN KEY (`paperTradeId`) REFERENCES `paperTrades`(`id`) ON DELETE set null ON UPDATE no action;
