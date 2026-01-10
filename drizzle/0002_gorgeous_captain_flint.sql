CREATE TABLE `securityAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` int,
	`eventType` enum('encryption_applied','access_granted','access_denied','rate_limit_triggered','input_sanitized','session_protected','data_integrity_verified','privacy_preserved','threat_blocked','consent_protected') NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`description` text NOT NULL,
	`metadata` json,
	`ipHash` varchar(64),
	`userAgent` text,
	`timestamp` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `securityAuditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `securitySummaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`encryptionCount` int NOT NULL DEFAULT 0,
	`accessControlCount` int NOT NULL DEFAULT 0,
	`sanitizationCount` int NOT NULL DEFAULT 0,
	`privacyProtectionCount` int NOT NULL DEFAULT 0,
	`consentProtectionCount` int NOT NULL DEFAULT 0,
	`threatBlockedCount` int NOT NULL DEFAULT 0,
	`totalProtectionCount` int NOT NULL DEFAULT 0,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `securitySummaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `securitySummaries_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
ALTER TABLE `securityAuditLogs` ADD CONSTRAINT `securityAuditLogs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `securityAuditLogs` ADD CONSTRAINT `securityAuditLogs_sessionId_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `securitySummaries` ADD CONSTRAINT `securitySummaries_sessionId_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `sessions`(`id`) ON DELETE no action ON UPDATE no action;