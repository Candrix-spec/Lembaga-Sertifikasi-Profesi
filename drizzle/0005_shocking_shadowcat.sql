CREATE TABLE `assessment_years` (
	`id` text PRIMARY KEY NOT NULL,
	`year` text NOT NULL,
	`label` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assessment_years_year_unique` ON `assessment_years` (`year`);--> statement-breakpoint
ALTER TABLE `attempts` ADD `assessment_year` text DEFAULT '2026' NOT NULL;--> statement-breakpoint
CREATE INDEX `attempt_assessment_year` ON `attempts` (`assessment_year`);--> statement-breakpoint
ALTER TABLE `documents` ADD `assessment_year` text DEFAULT '2026' NOT NULL;--> statement-breakpoint
CREATE INDEX `doc_assessment_year` ON `documents` (`assessment_year`);--> statement-breakpoint
ALTER TABLE `schedules` ADD `assessment_year` text DEFAULT '2026' NOT NULL;--> statement-breakpoint
CREATE INDEX `schedules_assessment_year` ON `schedules` (`assessment_year`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `assessment_year` text DEFAULT '2026' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `assessment_year` text DEFAULT '2026' NOT NULL;--> statement-breakpoint
CREATE INDEX `users_assessment_year` ON `users` (`assessment_year`);