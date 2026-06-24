CREATE TABLE `ai_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`api_key` text NOT NULL,
	`default_model` text,
	`default_headers` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_providers_user_id_idx` ON `ai_providers` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_providers_user_name_uq` ON `ai_providers` (`user_id`,`name`);--> statement-breakpoint
ALTER TABLE `presets` ADD `provider_id` text REFERENCES ai_providers(id);--> statement-breakpoint
ALTER TABLE `presets` ADD `model` text;--> statement-breakpoint
CREATE INDEX `presets_provider_id_idx` ON `presets` (`provider_id`);