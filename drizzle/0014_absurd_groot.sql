CREATE TABLE `disasterRecoveryArchives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`exportId` varchar(96) NOT NULL,
	`status` enum('creating','verified','failed','expired') NOT NULL,
	`archiveFormat` varchar(32) NOT NULL,
	`archiveVersion` varchar(32) NOT NULL,
	`applicationVersion` varchar(64) NOT NULL,
	`schemaVersion` varchar(96) NOT NULL,
	`datasetVersions` json NOT NULL,
	`manifest` json NOT NULL,
	`componentChecksums` json NOT NULL,
	`archiveChecksum` varchar(128) NOT NULL,
	`archiveSizeBytes` bigint NOT NULL DEFAULT 0,
	`storageKey` varchar(255),
	`storageUrl` varchar(512),
	`retentionUntil` timestamp NOT NULL,
	`verification` json,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`verifiedAt` timestamp,
	CONSTRAINT `disasterRecoveryArchives_id` PRIMARY KEY(`id`),
	CONSTRAINT `disaster_recovery_archive_export_id_unique` UNIQUE(`exportId`)
);
--> statement-breakpoint
ALTER TABLE `disasterRecoveryArchives` ADD CONSTRAINT `disasterRecoveryArchives_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `disaster_recovery_archive_user_created_idx` ON `disasterRecoveryArchives` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `disaster_recovery_archive_retention_idx` ON `disasterRecoveryArchives` (`retentionUntil`,`status`);