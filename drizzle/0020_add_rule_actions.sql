-- Add rule actions support to categorization rules system
-- This enables rules to perform multiple actions (set category, modify description, set merchant, etc.)

-- Step 1: Add actions column to categorization_rules table
ALTER TABLE categorization_rules ADD COLUMN actions TEXT;

-- Step 2: Migrate existing rules with category_id to actions array format
-- For each rule with a category_id, create an actions array with a single set_category action
UPDATE categorization_rules
SET actions = json_array(json_object('type', 'set_category', 'value', category_id))
WHERE category_id IS NOT NULL;

-- Step 3: Add applied_actions column to rule_execution_log table
ALTER TABLE rule_execution_log ADD COLUMN applied_actions TEXT;

-- Step 4: Populate applied_actions for existing execution logs
-- Create actions array from applied_category_id for historical records
UPDATE rule_execution_log
SET applied_actions = json_array(json_object('type', 'set_category', 'field', 'categoryId', 'newValue', applied_category_id, 'originalValue', NULL))
WHERE applied_category_id IS NOT NULL;

-- Note: category_id in categorization_rules is now nullable and kept for backward compatibility
-- Note: applied_category_id in rule_execution_log is now nullable (future logs may not set category)
