ALTER TABLE `chats` ADD `provider_id` text REFERENCES ai_providers(id);--> statement-breakpoint
ALTER TABLE `chats` ADD `preset_id` text REFERENCES presets(id);--> statement-breakpoint
ALTER TABLE `chats` ADD `selected_model` text;--> statement-breakpoint
CREATE INDEX `chats_provider_id_idx` ON `chats` (`provider_id`);--> statement-breakpoint
CREATE INDEX `chats_preset_id_idx` ON `chats` (`preset_id`);