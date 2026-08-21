CREATE TABLE `alertExecutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertId` int NOT NULL,
	`status` enum('completed','failed') NOT NULL,
	`triggered` boolean NOT NULL DEFAULT false,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp NOT NULL,
	`executionSnapshot` json NOT NULL,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alertExecutions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `alertExecutions` ADD CONSTRAINT `alertExecutions_alertId_alerts_id_fk` FOREIGN KEY (`alertId`) REFERENCES `alerts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `alert_executions_alert_time_idx` ON `alertExecutions` (`alertId`,`createdAt`);