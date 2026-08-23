CREATE TABLE IF NOT EXISTS `admin_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_email` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_audit_created_at_idx` ON `admin_audit` (`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`event_type` text NOT NULL,
	`path` text DEFAULT '/' NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`referrer` text DEFAULT '' NOT NULL,
	`utm_source` text DEFAULT '' NOT NULL,
	`utm_medium` text DEFAULT '' NOT NULL,
	`utm_campaign` text DEFAULT '' NOT NULL,
	`utm_content` text DEFAULT '' NOT NULL,
	`utm_term` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`timezone` text DEFAULT '' NOT NULL,
	`device_type` text DEFAULT 'unknown' NOT NULL,
	`browser` text DEFAULT 'unknown' NOT NULL,
	`ip_address` text DEFAULT '' NOT NULL,
	`ip_hash` text DEFAULT '' NOT NULL,
	`ip_masked` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `events_created_at_idx` ON `events` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `events_session_idx` ON `events` (`session_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `events_type_idx` ON `events` (`event_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `events_country_idx` ON `events` (`country`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`organization` text NOT NULL,
	`interest` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`source_page` text DEFAULT '/' NOT NULL,
	`referrer` text DEFAULT '' NOT NULL,
	`utm_source` text DEFAULT '' NOT NULL,
	`utm_medium` text DEFAULT '' NOT NULL,
	`utm_campaign` text DEFAULT '' NOT NULL,
	`utm_content` text DEFAULT '' NOT NULL,
	`utm_term` text DEFAULT '' NOT NULL,
	`session_id` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`timezone` text DEFAULT '' NOT NULL,
	`ip_address` text DEFAULT '' NOT NULL,
	`ip_hash` text DEFAULT '' NOT NULL,
	`ip_masked` text DEFAULT '' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `leads_created_at_idx` ON `leads` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `leads_status_idx` ON `leads` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `leads_email_idx` ON `leads` (`email`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `leads_session_idx` ON `leads` (`session_id`);
