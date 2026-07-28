DROP INDEX `characters_user_name_idx`;
--> statement-breakpoint
CREATE INDEX `characters_user_name_idx` ON `characters` (`user_id`, `name` COLLATE NOCASE);
--> statement-breakpoint
UPDATE `characters` SET
  `creator`       = COALESCE(json_extract(`data`, '$.creator'), ''),
  `creator_notes` = COALESCE(json_extract(`data`, '$.creator_notes'), ''),
  `tags`          = COALESCE(json_extract(`data`, '$.tags'), '[]');
