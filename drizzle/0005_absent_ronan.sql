ALTER TABLE `alertExecutions` ADD `outcomeStatus` enum('SUCCESS','NO_MATCH','FAILED','SKIPPED');--> statement-breakpoint
ALTER TABLE `alertExecutions` ADD `executionKind` enum('scheduled','manual');--> statement-breakpoint
ALTER TABLE `alertExecutions` ADD `httpStatus` int;--> statement-breakpoint
ALTER TABLE `alertExecutions` ADD `durationMs` int;--> statement-breakpoint
ALTER TABLE `alertExecutions` ADD `assetsScanned` int;--> statement-breakpoint
ALTER TABLE `alertExecutions` ADD `qualifyingOpportunities` int;--> statement-breakpoint
ALTER TABLE `alertExecutions` ADD `configurationVersion` varchar(96);--> statement-breakpoint
ALTER TABLE `alertExecutions` ADD `configurationFingerprint` varchar(128);--> statement-breakpoint
ALTER TABLE `alertExecutions` ADD `notificationStatus` enum('not_requested','not_sent','sent','failed');--> statement-breakpoint
ALTER TABLE `alertExecutions` ADD `marketRegimeSnapshot` json;--> statement-breakpoint
ALTER TABLE `alertExecutions` ADD `sectorSnapshots` json;--> statement-breakpoint
ALTER TABLE `alertExecutions` ADD `signalSnapshots` json;--> statement-breakpoint
ALTER TABLE `alertExecutions` ADD `dataProvenance` json;