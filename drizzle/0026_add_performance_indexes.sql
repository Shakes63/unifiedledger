-- Migration 0026: Add composite indexes for transaction creation performance
-- These indexes optimize the frequent queries in POST /api/transactions
-- Expected improvement: 20-40% faster queries

-- Bills composite index for category-based matching
-- Used in: app/api/transactions/route.ts:621-630
-- Query: WHERE user_id = ? AND is_active = true AND category_id = ?
CREATE INDEX IF NOT EXISTS idx_bills_user_active_category ON bills(user_id, is_active, category_id);

-- Bill instances composite index for fetching pending instances
-- Used in: app/api/transactions/route.ts:637-645
-- Query: WHERE bill_id = ? AND status = 'pending'
CREATE INDEX IF NOT EXISTS idx_bill_instances_bill_status ON bill_instances(bill_id, status);

-- Debts composite index for category-based matching
-- Used in: app/api/transactions/route.ts:782-789
-- Query: WHERE user_id = ? AND status = 'active' AND category_id = ?
CREATE INDEX IF NOT EXISTS idx_debts_user_status_category ON debts(user_id, status, category_id);

-- Debt payoff milestones composite index for checking achievements
-- Used in: app/api/transactions/route.ts:744-759, 846-861, 920-935
-- Query: WHERE debt_id = ? [AND achieved_at IS NULL AND milestone_balance <= ?]
CREATE INDEX IF NOT EXISTS idx_debt_payoff_milestones_debt_achieved ON debt_payoff_milestones(debt_id, achieved_at);

-- Usage analytics composite index for tracking category/merchant usage
-- Used in: app/api/transactions/route.ts:486-496, 556-566
-- Query: WHERE user_id = ? AND item_type = ? AND item_id = ?
CREATE INDEX IF NOT EXISTS idx_usage_analytics_user_type_item ON usage_analytics(user_id, item_type, item_id);
