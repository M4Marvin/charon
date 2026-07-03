PRAGMA foreign_keys = OFF;
--> statement-breakpoint
CREATE TABLE `ai_providers__new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
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
INSERT INTO `ai_providers__new` SELECT * FROM `ai_providers`;
--> statement-breakpoint
DROP TABLE `ai_providers`;
--> statement-breakpoint
ALTER TABLE `ai_providers__new` RENAME TO `ai_providers`;
--> statement-breakpoint
CREATE INDEX `ai_providers_user_id_idx` ON `ai_providers` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_providers_user_name_uq` ON `ai_providers` (`user_id`,`name`);
--> statement-breakpoint
PRAGMA foreign_keys = ON;
