-- Migration: Phase 1.3 Bill Instances & Payments
-- Part of Unified Debt, Bill & Credit Card Architecture
-- 
-- This migration adds:
-- 1. Partial payment tracking fields to bill_instances
-- 2. Principal/interest breakdown for debt bill payments
-- 3. New bill_payments table for tracking individual payments
-- 4. New bill_milestones table for payoff milestone tracking

-- Add partial payment fields to bill_instances
ALTER TABLE bill_instances ADD COLUMN paid_amount REAL DEFAULT 0;
ALTER TABLE bill_instances ADD COLUMN remaining_amount REAL;
ALTER TABLE bill_instances ADD COLUMN payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE bill_instances ADD COLUMN principal_paid REAL DEFAULT 0;
ALTER TABLE bill_instances ADD COLUMN interest_paid REAL DEFAULT 0;

-- Create bill_payments table for tracking individual payments
CREATE TABLE IF NOT EXISTS bill_payments (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  bill_instance_id TEXT,
  transaction_id TEXT,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  amount REAL NOT NULL,
  principal_amount REAL,
  interest_amount REAL,
  payment_date TEXT NOT NULL,
  payment_method TEXT DEFAULT 'manual',
  linked_account_id TEXT,
  balance_before_payment REAL,
  balance_after_payment REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bill_payments_bill ON bill_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_instance ON bill_payments(bill_instance_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_transaction ON bill_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_user ON bill_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_household ON bill_payments(household_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_date ON bill_payments(payment_date);

-- Create bill_milestones table for payoff milestone tracking
CREATE TABLE IF NOT EXISTS bill_milestones (
  id TEXT PRIMARY KEY,
  bill_id TEXT,
  account_id TEXT,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  percentage INTEGER NOT NULL,
  milestone_balance REAL NOT NULL,
  achieved_at TEXT,
  notification_sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bill_milestones_bill ON bill_milestones(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_milestones_account ON bill_milestones(account_id);
CREATE INDEX IF NOT EXISTS idx_bill_milestones_user ON bill_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_milestones_household ON bill_milestones(household_id);
CREATE INDEX IF NOT EXISTS idx_bill_milestones_percentage ON bill_milestones(percentage);

-- Add index for payment_status queries
CREATE INDEX IF NOT EXISTS idx_bill_instances_payment_status ON bill_instances(payment_status);

