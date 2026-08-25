CREATE TABLE `paperTradeMonitoringEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tradeId` int NOT NULL,
	`eventKey` varchar(160) NOT NULL,
	`eventType` enum('TARGET_REACHED','REVERSAL_WARNING','SETUP_INVALIDATED') NOT NULL,
	`observation` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paperTradeMonitoringEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `paper_trade_monitoring_event_unique` UNIQUE(`tradeId`,`eventKey`)
);
--> statement-breakpoint
ALTER TABLE `paperTradeMonitoringEvents` ADD CONSTRAINT `paperTradeMonitoringEvents_tradeId_paperTrades_id_fk` FOREIGN KEY (`tradeId`) REFERENCES `paperTrades`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `paper_trade_monitoring_trade_time_idx` ON `paperTradeMonitoringEvents` (`tradeId`,`createdAt`);