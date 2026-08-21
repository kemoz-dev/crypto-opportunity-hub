CREATE TABLE `historicalIngestionSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`cronExpression` varchar(64) NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`configuration` json NOT NULL,
	`lastDatasetId` int,
	`lastRunAt` timestamp,
	`lastStatus` enum('SUCCESS','PARTIAL','FAILED','SKIPPED'),
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `historicalIngestionSchedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `historical_ingestion_schedule_name_unique` UNIQUE(`name`),
	CONSTRAINT `historical_ingestion_schedule_task_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
ALTER TABLE `historicalIngestionSchedules` ADD CONSTRAINT `historicalIngestionSchedules_lastDatasetId_historicalDatasets_id_fk` FOREIGN KEY (`lastDatasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `historical_ingestion_schedule_enabled_idx` ON `historicalIngestionSchedules` (`isEnabled`,`updatedAt`);