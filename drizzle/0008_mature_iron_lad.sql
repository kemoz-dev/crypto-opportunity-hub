ALTER TABLE `researchExperiments` ADD `datasetId` int;--> statement-breakpoint
ALTER TABLE `researchExperiments` ADD `datasetVersion` varchar(96);--> statement-breakpoint
ALTER TABLE `researchExperiments` ADD `datasetFingerprint` varchar(128);--> statement-breakpoint
ALTER TABLE `researchExperiments` ADD `modelConfigurationFingerprint` varchar(128);--> statement-breakpoint
ALTER TABLE `researchExperiments` ADD `instrumentType` enum('spot','perpetual');--> statement-breakpoint
ALTER TABLE `researchExperiments` ADD `costModel` json;--> statement-breakpoint
ALTER TABLE `researchExperiments` ADD CONSTRAINT `researchExperiments_datasetId_historicalDatasets_id_fk` FOREIGN KEY (`datasetId`) REFERENCES `historicalDatasets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `research_experiments_dataset_idx` ON `researchExperiments` (`datasetId`,`createdAt`);