ALTER TABLE `autoPaperAccounts` MODIFY COLUMN `startingCapital` double NOT NULL DEFAULT 100000;--> statement-breakpoint
ALTER TABLE `autoPaperAccounts` MODIFY COLUMN `currentEquity` double NOT NULL DEFAULT 100000;--> statement-breakpoint
ALTER TABLE `autoPaperAccounts` MODIFY COLUMN `availableCash` double NOT NULL DEFAULT 100000;