PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `user` ADD `username` text;--> statement-breakpoint
ALTER TABLE `user` ADD `display_username` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE TABLE `__new_backgrounds` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`created_at` integer NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_backgrounds`("id", "name", "path", "created_at") SELECT "id", "name", "path", "created_at" FROM `backgrounds`;--> statement-breakpoint
DROP TABLE `backgrounds`;--> statement-breakpoint
ALTER TABLE `__new_backgrounds` RENAME TO `backgrounds`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
