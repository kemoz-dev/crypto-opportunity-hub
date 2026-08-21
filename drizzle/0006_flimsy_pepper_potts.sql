CREATE TABLE `researchExperimentResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`experimentId` int NOT NULL,
	`dimension` enum('aggregate','combination','opportunity_threshold','confidence_threshold','joint_threshold','score_bucket','confidence_bucket','regime','sector','in_sample','out_of_sample') NOT NULL,
	`dimensionKey` varchar(128) NOT NULL,
	`signalCount` int NOT NULL,
	`evidenceStatus` enum('SUPPORTED','WEAK EVIDENCE','UNSUPPORTED','INSUFFICIENT DATA') NOT NULL,
	`metrics` json NOT NULL,
	`reason` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `researchExperimentResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `researchExperiments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`status` enum('queued','running','completed','failed') NOT NULL,
	`protocolVersion` varchar(64) NOT NULL,
	`configurationFingerprint` varchar(128) NOT NULL,
	`configuration` json NOT NULL,
	`dataProvenance` json NOT NULL,
	`dataStartAt` timestamp,
	`dataEndAt` timestamp,
	`resultSnapshot` json,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `researchExperiments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `researchExperimentResults` ADD CONSTRAINT `researchExperimentResults_experimentId_researchExperiments_id_fk` FOREIGN KEY (`experimentId`) REFERENCES `researchExperiments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `researchExperiments` ADD CONSTRAINT `researchExperiments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `research_experiment_results_experiment_dimension_idx` ON `researchExperimentResults` (`experimentId`,`dimension`);--> statement-breakpoint
CREATE INDEX `research_experiments_user_created_idx` ON `researchExperiments` (`userId`,`createdAt`);