-- Add credit limit field to debts table for credit utilization tracking
ALTER TABLE debts ADD COLUMN credit_limit REAL;
