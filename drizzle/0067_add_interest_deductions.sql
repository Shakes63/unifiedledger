-- Phase 11: Tax Integration - Interest Deduction Tracking
-- Tracks interest payments from debt bills for tax deduction purposes

CREATE TABLE IF NOT EXISTS interest_deductions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  bill_payment_id TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  deduction_type TEXT NOT NULL CHECK (deduction_type IN ('mortgage', 'student_loan', 'business', 'heloc_home')),
  interest_amount REAL NOT NULL,
  deductible_amount REAL NOT NULL,
  limit_applied REAL,
  bill_limit_applied INTEGER DEFAULT 0,
  annual_limit_applied INTEGER DEFAULT 0,
  payment_date TEXT NOT NULL,
  tax_category_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_payment_id) REFERENCES bill_payments(id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_interest_deductions_user ON interest_deductions(user_id);
CREATE INDEX IF NOT EXISTS idx_interest_deductions_household ON interest_deductions(household_id);
CREATE INDEX IF NOT EXISTS idx_interest_deductions_year ON interest_deductions(tax_year);
CREATE INDEX IF NOT EXISTS idx_interest_deductions_type ON interest_deductions(deduction_type);
CREATE INDEX IF NOT EXISTS idx_interest_deductions_bill ON interest_deductions(bill_id);
CREATE INDEX IF NOT EXISTS idx_interest_deductions_payment ON interest_deductions(bill_payment_id);
CREATE INDEX IF NOT EXISTS idx_interest_deductions_user_year_type ON interest_deductions(user_id, tax_year, deduction_type);

