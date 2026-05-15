CREATE TABLE `student_enrollment_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` text,
	`admission_number` text,
	`first_name` text,
	`last_name` text,
	`gender` text,
	`grade_applying_for` text,
	`guardian_name` text,
	`relationship` text,
	`phone_number` text,
	`email` text,
	`emergency_number` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
