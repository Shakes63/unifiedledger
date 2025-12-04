-- Phase 12: CSV Import Enhancements
-- Add support for credit card statement detection, transaction type auto-detection,
-- statement info capture, and transfer duplicate prevention

-- 1. Update import_templates table
ALTER TABLE import_templates ADD COLUMN source_type TEXT DEFAULT 'auto';
-- Values: 'bank', 'credit_card', 'auto'

ALTER TABLE import_templates ADD COLUMN issuer TEXT;
-- Values: 'chase', 'amex', 'capital_one', 'discover', 'citi', 'bank_of_america', 'wells_fargo', 'other'

ALTER TABLE import_templates ADD COLUMN amount_sign_convention TEXT DEFAULT 'standard';
-- Values: 'standard' (positive=income, negative=expense), 'credit_card' (positive=charge, negative=payment)

ALTER TABLE import_templates ADD COLUMN transaction_type_patterns TEXT;
-- JSON: Custom patterns for detecting transaction types

ALTER TABLE import_templates ADD COLUMN statement_info_config TEXT;
-- JSON: Configuration for extracting statement info from header rows

-- 2. Update import_history table
ALTER TABLE import_history ADD COLUMN source_type TEXT;
ALTER TABLE import_history ADD COLUMN statement_info TEXT;
-- JSON: { statementBalance, statementDate, dueDate, minimumPayment, creditLimit }

-- 3. Update import_staging table
ALTER TABLE import_staging ADD COLUMN cc_transaction_type TEXT;
-- Values: 'purchase', 'payment', 'refund', 'interest', 'fee', 'cash_advance', 'balance_transfer', 'reward'

ALTER TABLE import_staging ADD COLUMN potential_transfer_id TEXT;
ALTER TABLE import_staging ADD COLUMN transfer_match_confidence REAL;

-- Create index for transfer matching
CREATE INDEX IF NOT EXISTS idx_import_staging_transfer ON import_staging(potential_transfer_id);
CREATE INDEX IF NOT EXISTS idx_import_staging_cc_type ON import_staging(cc_transaction_type);

