CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`group_number` text NOT NULL,
	`scheme_id` text NOT NULL,
	`assessor_id` text NOT NULL,
	`schedule_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `schedules_assessor` ON `schedules` (`assessor_id`);--> statement-breakpoint
CREATE INDEX `schedules_group` ON `schedules` (`group_number`,`schedule_date`);--> statement-breakpoint
ALTER TABLE `users` ADD `group_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `users_group` ON `users` (`group_number`);