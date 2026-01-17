ALTER TABLE accounts ADD COLUMN include_in_discretionary INTEGER DEFAULT 1;--> statement-breakpoint
UPDATE accounts SET include_in_discretionary = 0 WHERE type IN ('savings', 'credit', 'line_of_credit', 'investment');--> statement-breakpoint
UPDATE accounts SET include_in_discretionary = 1 WHERE type IN ('checking', 'cash');
