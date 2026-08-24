CREATE TABLE `providerMonitorChecks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionId` int NOT NULL,
	`provider` varchar(96) NOT NULL,
	`capability` varchar(32) NOT NULL,
	`status` enum('live','stale','unavailable') NOT NULL,
	`httpStatus` int,
	`classification` varchar(96),
	`latencyMs` int NOT NULL,
	`timeframe` varchar(12),
	`symbolsTested` json NOT NULL,
	`fallbackUsed` boolean NOT NULL DEFAULT false,
	`dataQuality` enum('VALID','UNAVAILABLE') NOT NULL,
	`details` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `providerMonitorChecks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `providerMonitorExecutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`monitorId` int NOT NULL,
	`taskUid` varchar(65) NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`executionKind` enum('SCHEDULED') NOT NULL,
	`status` enum('SUCCESS','PARTIAL','FAILED','SKIPPED') NOT NULL,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`durationMs` int,
	`summary` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `providerMonitorExecutions_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_monitor_execution_idempotency_unique` UNIQUE(`monitorId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `providerMonitors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`cronExpression` varchar(64) NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`configuration` json NOT NULL,
	`lastRunAt` timestamp,
	`lastStatus` enum('SUCCESS','PARTIAL','FAILED','SKIPPED'),
	`lastError` text,
	`nextRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `providerMonitors_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_monitor_name_unique` UNIQUE(`name`),
	CONSTRAINT `provider_monitor_task_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
ALTER TABLE `providerMonitorChecks` ADD CONSTRAINT `pmc_execution_fk` FOREIGN KEY (`executionId`) REFERENCES `providerMonitorExecutions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `providerMonitorExecutions` ADD CONSTRAINT `pme_monitor_fk` FOREIGN KEY (`monitorId`) REFERENCES `providerMonitors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `provider_monitor_check_execution_idx` ON `providerMonitorChecks` (`executionId`);--> statement-breakpoint
CREATE INDEX `provider_monitor_check_provider_time_idx` ON `providerMonitorChecks` (`provider`,`createdAt`);--> statement-breakpoint
CREATE INDEX `provider_monitor_execution_monitor_time_idx` ON `providerMonitorExecutions` (`monitorId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `provider_monitor_execution_task_time_idx` ON `providerMonitorExecutions` (`taskUid`,`createdAt`);
