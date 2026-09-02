CREATE TABLE IF NOT EXISTS `delegated_responsibilities` (
  `id` text PRIMARY KEY NOT NULL,
  `school_id` text NOT NULL,
  `teacher_profile_id` text NOT NULL,
  `responsibility` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`teacher_profile_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_profiles_user_id_idx` ON `admin_profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_profiles_school_id_idx` ON `admin_profiles` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `teacher_profiles_user_id_idx` ON `teacher_profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `teacher_profiles_school_id_idx` ON `teacher_profiles` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `student_profiles_user_id_idx` ON `student_profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `student_profiles_school_id_idx` ON `student_profiles` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `parent_profiles_user_id_idx` ON `parent_profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `parent_profiles_school_id_idx` ON `parent_profiles` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `parent_student_relations_parent_idx` ON `parent_student_relations` (`parent_profile_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `parent_student_relations_student_idx` ON `parent_student_relations` (`student_profile_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `classes_school_id_idx` ON `classes` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `classes_teacher_profile_id_idx` ON `classes` (`teacher_profile_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `enrollments_class_idx` ON `enrollments` (`class_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `enrollments_student_idx` ON `enrollments` (`student_profile_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `assignments_class_id_idx` ON `assignments` (`class_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `grades_assignment_id_idx` ON `grades` (`assignment_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `grades_student_profile_id_idx` ON `grades` (`student_profile_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `announcements_school_id_idx` ON `announcements` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `student_enrollment_submissions_school_id_idx` ON `student_enrollment_submissions` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `messages_school_id_idx` ON `messages` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `messages_sender_id_idx` ON `messages` (`sender_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `messages_receiver_id_idx` ON `messages` (`receiver_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `attendance_class_id_idx` ON `attendance` (`class_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `attendance_student_profile_id_idx` ON `attendance` (`student_profile_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `attendance_date_idx` ON `attendance` (`date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `portfolio_evidence_class_id_idx` ON `portfolio_evidence` (`class_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `portfolio_evidence_student_profile_id_idx` ON `portfolio_evidence` (`student_profile_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payments_school_id_idx` ON `payments` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payments_student_profile_id_idx` ON `payments` (`student_profile_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `activity_logs_school_id_idx` ON `activity_logs` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_school_id_idx` ON `audit_logs` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `fee_structures_school_id_idx` ON `fee_structures` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `fee_structures_class_id_idx` ON `fee_structures` (`class_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `timetables_school_id_idx` ON `timetables` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `teacher_remarks_student_profile_id_idx` ON `teacher_remarks` (`student_profile_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `teacher_remarks_teacher_profile_id_idx` ON `teacher_remarks` (`teacher_profile_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `delegated_responsibilities_school_id_idx` ON `delegated_responsibilities` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `delegated_responsibilities_teacher_profile_id_idx` ON `delegated_responsibilities` (`teacher_profile_id`);
