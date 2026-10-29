ALTER TABLE `leads` ADD `request_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `leads_request_key_unique` ON `leads` (`request_key`);--> statement-breakpoint
CREATE INDEX `leads_email_created_idx` ON `leads` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `leads_created_id_idx` ON `leads` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `leads_status_created_idx` ON `leads` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `chat_limits_expiry_idx` ON `chat_limits` (`expires_at`);--> statement-breakpoint
CREATE INDEX `products_public_order_idx` ON `products` (`status`,`sort_order`,`created_at`);