CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`default_provider_id` text,
	`default_preset_id` text,
	`default_selected_model` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`default_provider_id`) REFERENCES `ai_providers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`default_preset_id`) REFERENCES `presets`(`id`) ON UPDATE no action ON DELETE set null
);
