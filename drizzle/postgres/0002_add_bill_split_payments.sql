-- Add split payment fields to bills table
ALTER TABLE bills ADD COLUMN IF NOT EXISTS split_across_periods BOOLEAN DEFAULT false;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS split_allocations TEXT;

-- Create bill instance allocations table for tracking period splits
CREATE TABLE IF NOT EXISTS bill_instance_allocations (
  id TEXT PRIMARY KEY NOT NULL,
  bill_instance_id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  period_number INTEGER NOT NULL,
  allocated_amount DOUBLE PRECISION NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  paid_amount DOUBLE PRECISION DEFAULT 0,
  allocation_id TEXT,
  created_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
  updated_at TEXT DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
);

-- Create indexes for bill instance allocations
CREATE INDEX IF NOT EXISTS idx_bill_allocations_instance ON bill_instance_allocations(bill_instance_id);
CREATE INDEX IF NOT EXISTS idx_bill_allocations_bill ON bill_instance_allocations(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_allocations_user ON bill_instance_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_allocations_household ON bill_instance_allocations(household_id);
CREATE INDEX IF NOT EXISTS idx_bill_allocations_period ON bill_instance_allocations(period_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_allocations_unique ON bill_instance_allocations(bill_instance_id, period_number);

