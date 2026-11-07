ALTER TABLE `products` ADD `app_version` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `download_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `download_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `download_size` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `download_sha256` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `download_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `download_updated_at` text DEFAULT '' NOT NULL;