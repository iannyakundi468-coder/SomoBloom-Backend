CREATE TABLE `teacher_remarks` (
	`id` text PRIMARY KEY NOT NULL,
	`student_profile_id` text NOT NULL,
	`teacher_profile_id` text NOT NULL,
	`remark` text NOT NULL,
	`term` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`student_profile_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_profile_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `timetables` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`term` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
