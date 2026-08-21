CREATE TABLE `researchReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(128) NOT NULL,
	`asOf` timestamp NOT NULL,
	`methodology` json NOT NULL,
	`report` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `researchReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `research_reports_as_of_idx` ON `researchReports` (`asOf`);