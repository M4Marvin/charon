CREATE TABLE `generation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`trigger` text NOT NULL,
	`prompt_mode` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`base_leaf_id` integer,
	`target` text,
	`input` text,
	`placeholder_local_id` integer,
	`lease_owner` text,
	`lease_epoch` integer DEFAULT 0 NOT NULL,
	`lease_expires_at` integer,
	`attempt` integer DEFAULT 0 NOT NULL,
	`requires_confirmation` integer DEFAULT false NOT NULL,
	`result` text,
	`error` text,
	`usage` text,
	`finish_reason` text,
	`draft_text` text,
	`chunk_seq` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generation_jobs_request_id_uq` ON `generation_jobs` (`request_id`);--> statement-breakpoint
CREATE INDEX `generation_jobs_chat_status_idx` ON `generation_jobs` (`chat_id`,`status`);--> statement-breakpoint
CREATE INDEX `generation_jobs_created_at_idx` ON `generation_jobs` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `generation_jobs_active_chat_uq` ON `generation_jobs` (`chat_id`) WHERE `status` IN ('queued', 'running', 'finalizing');--> statement-breakpoint
CREATE TABLE `generation_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`target_local_id` integer,
	`base_rev` integer,
	`base_hash` text,
	`proposed_content` text NOT NULL,
	`proposed_role` text,
	`meta` text,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`job_id`) REFERENCES `generation_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `generation_proposals_chat_idx` ON `generation_proposals` (`chat_id`,`status`);--> statement-breakpoint
CREATE INDEX `generation_proposals_job_idx` ON `generation_proposals` (`job_id`);--> statement-breakpoint
CREATE TABLE `chat_message_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`message_local_id` integer NOT NULL,
	`rev` integer NOT NULL,
	`content` text NOT NULL,
	`source` text NOT NULL,
	`job_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_message_revisions_uq` ON `chat_message_revisions` (`chat_id`,`message_local_id`,`rev`);--> statement-breakpoint
CREATE INDEX `chat_message_revisions_chat_idx` ON `chat_message_revisions` (`chat_id`);--> statement-breakpoint
CREATE TABLE `ai_chat_threads` (
	`thread_id` text PRIMARY KEY NOT NULL,
	`messages` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_runs` (
	`run_id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`parent_run_id` text,
	`subagent_run_id` text,
	`name` text,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`error` text,
	`usage` text,
	`detached_since` integer,
	`cancel_requested` integer DEFAULT false NOT NULL,
	`driver_epoch` integer
);
--> statement-breakpoint
CREATE INDEX `ai_runs_thread_idx` ON `ai_runs` (`thread_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `ai_interrupts` (
	`interrupt_id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_at` integer NOT NULL,
	`resolved_at` integer,
	`payload` text NOT NULL,
	`response` text
);
--> statement-breakpoint
CREATE INDEX `ai_interrupts_thread_idx` ON `ai_interrupts` (`thread_id`,`requested_at`);--> statement-breakpoint
CREATE INDEX `ai_interrupts_run_idx` ON `ai_interrupts` (`run_id`,`requested_at`);--> statement-breakpoint
CREATE TABLE `ai_metadata` (
	`namespace` text NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`revision` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`namespace`, `key`)
);
