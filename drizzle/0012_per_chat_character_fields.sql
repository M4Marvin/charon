PRAGMA foreign_keys = OFF;
--> statement-breakpoint
CREATE TABLE `chats__new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`character_id` text NOT NULL,
	`title` text NOT NULL,
	`background_path` text,
	`character_description` text,
	`character_personality` text,
	`character_scenario` text,
	`character_system_prompt` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `chats__new` (`id`, `user_id`, `character_id`, `title`, `background_path`, `metadata`, `created_at`, `updated_at`)
SELECT `id`, `user_id`, `character_id`, `title`, `background_path`, `metadata`, `created_at`, `updated_at` FROM `chats`;
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
