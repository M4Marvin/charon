ALTER TABLE `user_settings` ADD `default_persona_id` text REFERENCES personas(id);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `system_prompt` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `post_history_instructions` text;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `impersonation_prompt` text;