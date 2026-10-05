CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`topic` text NOT NULL,
	`audience` text NOT NULL,
	`channel` text NOT NULL,
	`tone` text NOT NULL,
	`key_points` text NOT NULL,
	`call_to_action` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "draft_status" CHECK("drafts"."status" in ('draft', 'reviewed')),
	CONSTRAINT "draft_channel" CHECK("drafts"."channel" in ('LinkedIn', 'X')),
	CONSTRAINT "draft_tone" CHECK("drafts"."tone" in ('Practical', 'Warm', 'Bold'))
);
--> statement-breakpoint
CREATE INDEX `idx_drafts_owner_updated` ON `drafts` (`owner_id`,`updated_at`);