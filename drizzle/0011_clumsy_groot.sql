CREATE TABLE `historicalIngestionIssueEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`issueId` int NOT NULL,
	`scheduleExecutionId` int,
	`ingestionRunId` int,
	`eventType` enum('DETECTED','RETRY_STARTED','RETRY_SUCCEEDED','RETRY_FAILED','RECHECKED') NOT NULL,
	`retryAttempt` int NOT NULL DEFAULT 0,
	`observedAt` timestamp NOT NULL,
	`details` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalIngestionIssueEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `historicalIngestionIssues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`datasetId` int,
	`scheduleExecutionId` int,
	`ingestionRunId` int,
	`issueKind` enum('PROVIDER_FAILURE','MISSING_RANGE','NO_NEW_CANDLES','SOURCE_UNAVAILABLE') NOT NULL,
	`assetId` varchar(96) NOT NULL,
	`exchange` varchar(64) NOT NULL,
	`provider` varchar(96) NOT NULL,
	`instrumentType` enum('spot','perpetual') NOT NULL,
	`timeframe` enum('15m','1h','4h','1d') NOT NULL,
	`expectedStartAt` timestamp,
	`expectedEndAt` timestamp,
	`actualStartAt` timestamp,
	`actualEndAt` timestamp,
	`missingIntervalCount` int NOT NULL DEFAULT 0,
	`errorReason` text,
	`firstDetectedAt` timestamp NOT NULL,
	`evidence` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalIngestionIssues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `historicalScheduleExecutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleId` int NOT NULL,
	`taskUid` varchar(65) NOT NULL,
	`datasetId` int,
	`status` enum('SUCCESS','PARTIAL','FAILED','SKIPPED') NOT NULL,
	`skipReason` varchar(128),
	`assetsAttempted` int NOT NULL DEFAULT 0,
	`assetsSucceeded` int NOT NULL DEFAULT 0,
	`assetsFailed` int NOT NULL DEFAULT 0,
	`candlesInserted` int NOT NULL DEFAULT 0,
	`candlesSkipped` int NOT NULL DEFAULT 0,
	`duplicatesDetected` int NOT NULL DEFAULT 0,
	`gapsDetected` int NOT NULL DEFAULT 0,
	`providerErrors` json NOT NULL,
	`retryCount` int NOT NULL DEFAULT 0,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historicalScheduleExecutions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `historicalIngestionRuns` ADD `scheduleExecutionId` int;--> statement-breakpoint
ALTER TABLE `historicalIngestionRuns` ADD `retryAttempt` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `historicalIngestionIssueEvents` ADD CONSTRAINT `hist_issue_event_issue_fk` FOREIGN KEY (`issueId`) REFERENCES `historicalIngestionIssues`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalIngestionIssueEvents` ADD CONSTRAINT `hist_issue_event_exec_fk` FOREIGN KEY (`scheduleExecutionId`) REFERENCES `historicalScheduleExecutions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalIngestionIssueEvents` ADD CONSTRAINT `hist_issue_event_run_fk` FOREIGN KEY (`ingestionRunId`) REFERENCES `historicalIngestionRuns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalIngestionIssues` ADD CONSTRAINT `hist_issue_dataset_fk` FOREIGN KEY (`datasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalIngestionIssues` ADD CONSTRAINT `hist_issue_exec_fk` FOREIGN KEY (`scheduleExecutionId`) REFERENCES `historicalScheduleExecutions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalIngestionIssues` ADD CONSTRAINT `hist_issue_run_fk` FOREIGN KEY (`ingestionRunId`) REFERENCES `historicalIngestionRuns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalIngestionIssues` ADD CONSTRAINT `hist_issue_asset_fk` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalScheduleExecutions` ADD CONSTRAINT `hist_sched_exec_schedule_fk` FOREIGN KEY (`scheduleId`) REFERENCES `historicalIngestionSchedules`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historicalScheduleExecutions` ADD CONSTRAINT `hist_sched_exec_dataset_fk` FOREIGN KEY (`datasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `historical_issue_event_issue_time_idx` ON `historicalIngestionIssueEvents` (`issueId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `historical_issue_event_execution_idx` ON `historicalIngestionIssueEvents` (`scheduleExecutionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `historical_ingestion_issue_scope_idx` ON `historicalIngestionIssues` (`assetId`,`instrumentType`,`timeframe`,`createdAt`);--> statement-breakpoint
CREATE INDEX `historical_ingestion_issue_execution_idx` ON `historicalIngestionIssues` (`scheduleExecutionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `historical_ingestion_issue_dataset_idx` ON `historicalIngestionIssues` (`datasetId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `historical_schedule_execution_schedule_time_idx` ON `historicalScheduleExecutions` (`scheduleId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `historical_schedule_execution_status_idx` ON `historicalScheduleExecutions` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `historical_schedule_execution_task_idx` ON `historicalScheduleExecutions` (`taskUid`,`createdAt`);--> statement-breakpoint
ALTER TABLE `historicalIngestionRuns` ADD CONSTRAINT `hist_run_sched_exec_fk` FOREIGN KEY (`scheduleExecutionId`) REFERENCES `historicalScheduleExecutions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `historical_ingestion_schedule_execution_idx` ON `historicalIngestionRuns` (`scheduleExecutionId`,`createdAt`);
