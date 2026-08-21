ALTER TABLE `alerts` ADD `scheduleCronTaskUid` varchar(65);--> statement-breakpoint
ALTER TABLE `alerts` ADD `lastSignalSnapshot` json;--> statement-breakpoint
CREATE INDEX `alerts_schedule_task_idx` ON `alerts` (`scheduleCronTaskUid`);