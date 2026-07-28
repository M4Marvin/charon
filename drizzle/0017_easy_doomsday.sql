ALTER TABLE `characters` ADD `creator` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `creator_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE INDEX `characters_user_updated_idx` ON `characters` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `characters_user_name_idx` ON `characters` (`user_id`,`name`);--> statement-breakpoint
ALTER TABLE `lorebooks` DROP COLUMN `image_path`;