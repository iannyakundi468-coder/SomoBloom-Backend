CREATE TABLE `class_subjects` (
	`class_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`teacher_profile_id` text,
	PRIMARY KEY(`class_id`, `subject_id`),
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_profile_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `class_subjects_class_idx` ON `class_subjects` (`class_id`);--> statement-breakpoint
CREATE INDEX `class_subjects_subject_idx` ON `class_subjects` (`subject_id`);--> statement-breakpoint
CREATE TABLE `delegated_responsibilities` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`teacher_profile_id` text NOT NULL,
	`responsibility` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_profile_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `delegated_responsibilities_school_id_idx` ON `delegated_responsibilities` (`school_id`);--> statement-breakpoint
CREATE INDEX `delegated_responsibilities_teacher_profile_id_idx` ON `delegated_responsibilities` (`teacher_profile_id`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `subjects_school_id_idx` ON `subjects` (`school_id`);--> statement-breakpoint
CREATE INDEX `activity_logs_school_id_idx` ON `activity_logs` (`school_id`);--> statement-breakpoint
CREATE INDEX `admin_profiles_user_id_idx` ON `admin_profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX `admin_profiles_school_id_idx` ON `admin_profiles` (`school_id`);--> statement-breakpoint
CREATE INDEX `announcements_school_id_idx` ON `announcements` (`school_id`);--> statement-breakpoint
CREATE INDEX `assignments_class_id_idx` ON `assignments` (`class_id`);--> statement-breakpoint
CREATE INDEX `attendance_class_id_idx` ON `attendance` (`class_id`);--> statement-breakpoint
CREATE INDEX `attendance_student_profile_id_idx` ON `attendance` (`student_profile_id`);--> statement-breakpoint
CREATE INDEX `attendance_date_idx` ON `attendance` (`date`);--> statement-breakpoint
CREATE INDEX `audit_logs_school_id_idx` ON `audit_logs` (`school_id`);--> statement-breakpoint
CREATE INDEX `classes_school_id_idx` ON `classes` (`school_id`);--> statement-breakpoint
CREATE INDEX `classes_teacher_profile_id_idx` ON `classes` (`teacher_profile_id`);--> statement-breakpoint
CREATE INDEX `enrollments_class_idx` ON `enrollments` (`class_id`);--> statement-breakpoint
CREATE INDEX `enrollments_student_idx` ON `enrollments` (`student_profile_id`);--> statement-breakpoint
CREATE INDEX `fee_structures_school_id_idx` ON `fee_structures` (`school_id`);--> statement-breakpoint
CREATE INDEX `fee_structures_class_id_idx` ON `fee_structures` (`class_id`);--> statement-breakpoint
CREATE INDEX `grades_assignment_id_idx` ON `grades` (`assignment_id`);--> statement-breakpoint
CREATE INDEX `grades_student_profile_id_idx` ON `grades` (`student_profile_id`);--> statement-breakpoint
CREATE INDEX `messages_school_id_idx` ON `messages` (`school_id`);--> statement-breakpoint
CREATE INDEX `messages_sender_id_idx` ON `messages` (`sender_id`);--> statement-breakpoint
CREATE INDEX `messages_receiver_id_idx` ON `messages` (`receiver_id`);--> statement-breakpoint
CREATE INDEX `parent_profiles_user_id_idx` ON `parent_profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX `parent_profiles_school_id_idx` ON `parent_profiles` (`school_id`);--> statement-breakpoint
CREATE INDEX `parent_student_relations_parent_idx` ON `parent_student_relations` (`parent_profile_id`);--> statement-breakpoint
CREATE INDEX `parent_student_relations_student_idx` ON `parent_student_relations` (`student_profile_id`);--> statement-breakpoint
CREATE INDEX `payments_school_id_idx` ON `payments` (`school_id`);--> statement-breakpoint
CREATE INDEX `payments_student_profile_id_idx` ON `payments` (`student_profile_id`);--> statement-breakpoint
CREATE INDEX `portfolio_evidence_class_id_idx` ON `portfolio_evidence` (`class_id`);--> statement-breakpoint
CREATE INDEX `portfolio_evidence_student_profile_id_idx` ON `portfolio_evidence` (`student_profile_id`);--> statement-breakpoint
CREATE INDEX `student_enrollment_submissions_school_id_idx` ON `student_enrollment_submissions` (`school_id`);--> statement-breakpoint
CREATE INDEX `student_profiles_user_id_idx` ON `student_profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX `student_profiles_school_id_idx` ON `student_profiles` (`school_id`);--> statement-breakpoint
CREATE INDEX `teacher_profiles_user_id_idx` ON `teacher_profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX `teacher_profiles_school_id_idx` ON `teacher_profiles` (`school_id`);--> statement-breakpoint
CREATE INDEX `teacher_remarks_student_profile_id_idx` ON `teacher_remarks` (`student_profile_id`);--> statement-breakpoint
CREATE INDEX `teacher_remarks_teacher_profile_id_idx` ON `teacher_remarks` (`teacher_profile_id`);--> statement-breakpoint
CREATE INDEX `timetables_school_id_idx` ON `timetables` (`school_id`);