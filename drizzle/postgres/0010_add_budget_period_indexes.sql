CREATE INDEX IF NOT EXISTS idx_bill_instances_household_due_status
  ON bill_instances(household_id, due_date, status);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bill_instances_user_household_due
  ON bill_instances(user_id, household_id, due_date);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_bill_allocations_household_period_instance
  ON bill_instance_allocations(household_id, period_number, bill_instance_id);
