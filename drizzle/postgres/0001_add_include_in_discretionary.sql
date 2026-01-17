ALTER TABLE accounts ADD COLUMN include_in_discretionary BOOLEAN DEFAULT true;--> statement-breakpoint
UPDATE accounts SET include_in_discretionary = false WHERE type IN ('savings', 'credit', 'line_of_credit', 'investment');--> statement-breakpoint
UPDATE accounts SET include_in_discretionary = true WHERE type IN ('checking', 'cash');
