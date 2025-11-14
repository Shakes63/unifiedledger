-- Migration: Populate household_settings from household creator's user_settings
-- Part of Phase 0: Settings Three-Tier Architecture
-- Created: 2025-11-14

-- For each household, use creator's settings as default household settings
INSERT INTO household_settings (
  id,
  household_id,
  currency,
  currency_symbol,
  time_format,
  fiscal_year_start,
  default_budget_method,
  budget_period,
  auto_categorization,
  data_retention_years,
  auto_cleanup_enabled,
  cache_strategy,
  created_at,
  updated_at
)
SELECT
  lower(hex(randomblob(16))) as id,
  h.id as household_id,
  COALESCE(us.currency, 'USD'),
  COALESCE(us.currency_symbol, '$'),
  COALESCE(us.time_format, '12h'),
  COALESCE(us.fiscal_year_start, 1),
  COALESCE(us.default_budget_method, 'monthly'),
  COALESCE(us.budget_period, 'monthly'),
  COALESCE(us.auto_categorization, 1),
  COALESCE(us.data_retention_years, 7),
  0 as auto_cleanup_enabled,
  'normal' as cache_strategy,
  datetime('now'),
  datetime('now')
FROM households h
LEFT JOIN user_settings us ON us.user_id = h.created_by;

-- Log migration completion
-- SELECT COUNT(*) as 'Records created in household_settings' FROM household_settings;
