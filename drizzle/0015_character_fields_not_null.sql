PRAGMA foreign_keys = OFF;
--> statement-breakpoint
CREATE TABLE `chats__new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`character_id` text NOT NULL,
	`title` text NOT NULL,
	`background_id` text,
	`character_description` text NOT NULL DEFAULT '',
	`character_personality` text NOT NULL DEFAULT '',
	`character_scenario` text NOT NULL DEFAULT '',
	`character_system_prompt` text NOT NULL DEFAULT '',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`background_id`) REFERENCES `backgrounds`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `chats__new` (`id`, `user_id`, `character_id`, `title`, `background_id`, `character_description`, `character_personality`, `character_scenario`, `character_system_prompt`, `created_at`, `updated_at`)
SELECT `id`, `user_id`, `character_id`, `title`, `background_id`, COALESCE(`character_description`, ''), COALESCE(`character_personality`, ''), COALESCE(`character_scenario`, ''), COALESCE(`character_system_prompt`, ''), `created_at`, `updated_at` FROM `chats`;
--> statement-breakpoint
DROP TABLE `chats`;
--> statement-breakpoint
ALTER TABLE `chats__new` RENAME TO `chats`;
--> statement-breakpoint
CREATE INDEX `chats_user_id_idx` ON `chats` (`user_id`);
--> statement-breakpoint
CREATE INDEX `chats_character_id_idx` ON `chats` (`character_id`);
--> statement-breakpoint
PRAGMA foreign_keys = ON;
