CREATE TABLE `character_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`rev` integer NOT NULL,
	`name` text NOT NULL,
	`tagline` text,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `character_revisions_character_idx` ON `character_revisions` (`character_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `character_revisions_character_rev_uq` ON `character_revisions` (`character_id`,`rev`);
--> statement-breakpoint
-- Backfill: seed revision 1 from each character's current state so the
-- "latest revision equals the current card" invariant holds for pre-existing
-- rows (id is a random hex uuid; rev 1 timestamped at the character's
-- last update).
INSERT INTO `character_revisions` (`id`, `character_id`, `rev`, `name`, `tagline`, `data`, `created_at`)
SELECT lower(hex(randomblob(16))), `id`, 1, `name`, `tagline`, `data`, `updated_at` FROM `characters`;
