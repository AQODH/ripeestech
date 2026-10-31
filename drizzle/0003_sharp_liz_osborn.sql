CREATE TABLE `chat_events` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_hash` text NOT NULL,
	`mode` text NOT NULL,
	`outcome` text NOT NULL,
	`topic` text NOT NULL,
	`latency_ms` integer NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`shared_question` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_events_created_idx` ON `chat_events` (`created_at`);