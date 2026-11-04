CREATE TABLE IF NOT EXISTS `admin_auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_started_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_auth_limits_window_idx` ON `admin_auth_limits` (`window_started_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_recovery_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`used_at` integer,
	`claim_id` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_recovery_codes_user_idx` ON `admin_recovery_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_sessions_expiry_idx` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_setup_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`used_at` integer,
	`claim_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `admin_setup_tokens_token_hash_unique` ON `admin_setup_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_setup_tokens_expiry_idx` ON `admin_setup_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `admin_users_email_unique` ON `admin_users` (`email`);