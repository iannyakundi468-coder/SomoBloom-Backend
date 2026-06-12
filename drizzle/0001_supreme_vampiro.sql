CREATE TABLE `fee_structures` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`class_id` text NOT NULL,
	`term` text NOT NULL,
	`total_amount` integer NOT NULL,
	`breakdown` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `school_settings` (
	`school_id` text PRIMARY KEY NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`xp_level_up` integer DEFAULT 150 NOT NULL,
	`xp_badge` integer DEFAULT 300 NOT NULL,
	`badges_enabled` integer DEFAULT true NOT NULL,
	`leaderboard_enabled` integer DEFAULT true NOT NULL,
	`notify_payment` integer DEFAULT true NOT NULL,
	`notify_portfolio` integer DEFAULT true NOT NULL,
	`notify_announcement` integer DEFAULT true NOT NULL,
	`data_retention_years` integer DEFAULT 5 NOT NULL,
	`allow_parent_messaging` integer DEFAULT true NOT NULL,
	`allow_student_leaderboard` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `student_enrollment_submissions` ADD `school_id` text NOT NULL REFERENCES schools(id);