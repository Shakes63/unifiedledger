-- Phase 15: Category Simplification
-- Migrate from 6 category types to 3 simplified types:
-- income, expense, savings (removing variable_expense, monthly_bill, non_monthly_bill, debt)

-- Migration: Convert old types to new unified 'expense' type
UPDATE budget_categories 
SET type = 'expense' 
WHERE type IN ('variable_expense', 'monthly_bill', 'non_monthly_bill', 'debt');

-- Note: The dueDate field remains in the schema for backwards compatibility
-- but is no longer used for new categories (bills handle their own due dates)

