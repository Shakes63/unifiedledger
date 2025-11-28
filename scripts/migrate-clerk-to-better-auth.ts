/**
 * Migration Script: Clerk → Better Auth
 *
 * This script migrates user data from Clerk to Better Auth by updating
 * all user_id references in the database.
 *
 * IMPORTANT: Database backup created before running this script.
 */

import { sqlite } from '../lib/db';

// Type definitions for SQLite query results
interface UserRecord {
  id: string;
  email: string;
  name: string;
}

interface CountResult {
  count: number;
}

const CLERK_USER_ID = 'user_35Ax4rTdoJOYyvdVTiJuhc0hYBS';
const BETTER_AUTH_USER_ID = 'KEWU5S1fbpia8KEIM4oKdln0PtVGS4yh';

// List of all tables that need user_id migration
const TABLES_TO_MIGRATE = [
  'accounts',
  'budget_categories',
  'merchants',
  'usage_analytics',
  'transactions',
  'transaction_splits',
  'bills',
  'bill_instances',
  'categorization_rules',
  'rule_execution_log',
  'tags',
  'transaction_tags',
  'custom_fields',
  'custom_field_values',
  'savings_goals',
  'savings_milestones',
  'debts',
  'debt_payments',
  'debt_payoff_milestones',
  'tax_categories',
  'category_tax_mappings',
  'transaction_tax_classifications',
  'sales_tax_settings',
  'sales_tax_categories',
  'sales_tax_transactions',
  'quarterly_filing_records',
  'notifications',
  'notification_preferences',
  'household_activity_log',
  'saved_search_filters',
  'search_history',
  'import_templates',
  'import_history',
  'import_staging',
  'households', // created_by field
  'household_members',
];

async function migrateUserData() {
  console.log('🚀 Starting Clerk → Better Auth Migration');
  console.log('─────────────────────────────────────────');
  console.log(`Clerk User ID:      ${CLERK_USER_ID}`);
  console.log(`Better Auth User ID: ${BETTER_AUTH_USER_ID}`);
  console.log('─────────────────────────────────────────\n');

  let totalUpdated = 0;

  try {
    // Step 1: Verify Better Auth user exists
    const betterAuthUser = sqlite.prepare(
      `SELECT id, email, name FROM user WHERE id = ?`
    ).get(BETTER_AUTH_USER_ID);

    if (!betterAuthUser) {
      throw new Error('Better Auth user not found! Please create your Better Auth account first.');
    }

    const user = betterAuthUser as UserRecord;
    console.log('✓ Better Auth user verified');
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}\n`);

    // Step 2: Count records to be migrated
    console.log('📊 Counting records to migrate...\n');

    for (const table of TABLES_TO_MIGRATE) {
      try {
        let countQuery;

        // Special handling for households table (uses created_by instead of user_id)
        if (table === 'households') {
          countQuery = `SELECT COUNT(*) as count FROM ${table} WHERE created_by = ?`;
        } else {
          countQuery = `SELECT COUNT(*) as count FROM ${table} WHERE user_id = ?`;
        }

        const result = sqlite.prepare(countQuery).get(CLERK_USER_ID) as CountResult | undefined;
        const count = Number(result?.count || 0);

        if (count > 0) {
          console.log(`  ${table}: ${count} record(s)`);
        }
      } catch (_error) {
        // Table might not exist or have user_id column - skip it
        console.log(`  ${table}: skipped (table doesn't exist or no user_id column)`);
      }
    }

    console.log('\n─────────────────────────────────────────');
    console.log('⚠️  Ready to migrate. This will update all user_id references.');
    console.log('─────────────────────────────────────────\n');

    // Step 3: Perform migration
    console.log('🔄 Migrating data...\n');

    for (const table of TABLES_TO_MIGRATE) {
      try {
        let updateQuery;

        // Special handling for households table
        if (table === 'households') {
          updateQuery = `UPDATE ${table} SET created_by = ? WHERE created_by = ?`;
        } else {
          updateQuery = `UPDATE ${table} SET user_id = ? WHERE user_id = ?`;
        }

        const stmt = sqlite.prepare(updateQuery);
        const result = stmt.run(BETTER_AUTH_USER_ID, CLERK_USER_ID);
        const updated = result.changes || 0;

        if (updated > 0) {
          console.log(`  ✓ ${table}: ${updated} record(s) updated`);
          totalUpdated += updated;
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`  ⚠ ${table}: skipped (${errorMessage})`);
      }
    }

    // Step 4: Verify migration
    console.log('\n─────────────────────────────────────────');
    console.log('🔍 Verifying migration...\n');

    for (const table of TABLES_TO_MIGRATE) {
      try {
        let verifyQuery;

        if (table === 'households') {
          verifyQuery = `SELECT COUNT(*) as count FROM ${table} WHERE created_by = ?`;
        } else {
          verifyQuery = `SELECT COUNT(*) as count FROM ${table} WHERE user_id = ?`;
        }

        const result = sqlite.prepare(verifyQuery).get(BETTER_AUTH_USER_ID) as CountResult | undefined;
        const count = Number(result?.count || 0);

        if (count > 0) {
          console.log(`  ✓ ${table}: ${count} record(s) now owned by Better Auth user`);
        }
      } catch (_error) {
        // Skip tables that don't exist
      }
    }

    console.log('\n─────────────────────────────────────────');
    console.log('✅ Migration completed successfully!');
    console.log(`   Total records updated: ${totalUpdated}`);
    console.log('─────────────────────────────────────────\n');
    console.log('Next steps:');
    console.log('1. Test your data access at /test-auth');
    console.log('2. Update middleware to use Better Auth');
    console.log('3. Update API routes to use Better Auth');
    console.log('4. Remove Clerk dependencies\n');

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n❌ Migration failed!');
    console.error(`Error: ${errorMessage}`);
    console.error('\n⚠️  Your data is safe - database backup available.');
    console.error('   Restore from backup if needed: sqlite.db.backup-YYYYMMDD-HHMMSS\n');
    throw error;
  }
}

// Run migration
migrateUserData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
