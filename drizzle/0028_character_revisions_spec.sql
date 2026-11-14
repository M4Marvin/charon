ALTER TABLE `character_revisions` ADD `spec` text NOT NULL DEFAULT 'chara_card_v2';
--> statement-breakpoint
ALTER TABLE `character_revisions` ADD `spec_version` text NOT NULL DEFAULT '2.0';
--> statement-breakpoint
-- Backfill: existing revision rows adopt their character's current spec (the
-- best available approximation for history written before this column
-- existed). Revisions created from now on snapshot spec on every write.
UPDATE `character_revisions`
SET `spec` = (SELECT `spec` FROM `characters` WHERE `characters`.`id` = `character_revisions`.`character_id`),
    `spec_version` = (SELECT `spec_version` FROM `characters` WHERE `characters`.`id` = `character_revisions`.`character_id`);
