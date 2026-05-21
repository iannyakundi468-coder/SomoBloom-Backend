ALTER TABLE `users` ADD `phone_number` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_number_unique` ON `users` (`phone_number`);