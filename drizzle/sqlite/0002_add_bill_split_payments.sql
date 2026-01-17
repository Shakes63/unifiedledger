ALTER TABLE bills ADD COLUMN split_across_periods INTEGER DEFAULT 0;--> statement-breakpoint
ALTER TABLE bills ADD COLUMN split_allocations TEXT;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS bill_instance_allocations (
  id TEXT PRIMARY KEY NOT NULL,
  bill_instance_id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  period_number INTEGER NOT NULL,
  allocated_amount REAL NOT NULL,
  is_paid INTEGER DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  allocation_id TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bill_allocations_instance ON bill_instance_allocations(bill_instance_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bill_allocations_bill ON bill_instance_allocations(bill_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bill_allocations_user ON bill_instance_allocations(user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bill_allocations_household ON bill_instance_allocations(household_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bill_allocations_period ON bill_instance_allocations(period_number);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_allocations_unique ON bill_instance_allocations(bill_instance_id, period_number);
