DROP INDEX IF EXISTS `generation_jobs_request_id_uq`;
--> statement-breakpoint
DROP INDEX IF EXISTS `generation_jobs_created_at_idx`;
--> statement-breakpoint
DROP TABLE IF EXISTS `chat_message_revisions`;
--> statement-breakpoint
ALTER TABLE `generation_jobs` DROP COLUMN `request_id`;
--> statement-breakpoint
ALTER TABLE `generation_jobs` DROP COLUMN `base_leaf_id`;
--> statement-breakpoint
ALTER TABLE `generation_jobs` DROP COLUMN `attempt`;
--> statement-breakpoint
ALTER TABLE `generation_jobs` DROP COLUMN `requires_confirmation`;
--> statement-breakpoint
ALTER TABLE `generation_jobs` DROP COLUMN `draft_text`;
--> statement-breakpoint
ALTER TABLE `generation_jobs` DROP COLUMN `chunk_seq`;
