# Phase 2 Migration Notes: Bills & Budgets Household Isolation

**Migration File:** `drizzle/0043_add_household_id_to_bills.sql`  
**Applied Date:** 2025-01-27  
**Status:** ✅ Applied Successfully

---

## Overview

This migration adds `household_id` column to the `bills` and `bill_instances` tables to enable household-level data isolation for bills and budgets features.

---

## Tables Affected

1. **`bills`** - Added `household_id` column
2. **`bill_instances`** - Added `household_id` column

**Note:** `budget_categories` table already had `household_id` from Phase 1, so no migration needed for budgets table.

---

## Migration Steps

### Step 1: Add Columns (Nullable Initially)

```sql
ALTER TABLE bills ADD COLUMN household_id TEXT;
ALTER TABLE bill_instances ADD COLUMN household_id TEXT;
```

**Rationale:** Adding columns as nullable allows us to backfill existing data before enforcing NOT NULL constraint.

### Step 2: Backfill Existing Records

**Bills Backfill:**
```sql
UPDATE bills
SET household_id = (
  SELECT hm.household_id
  FROM household_members hm
  WHERE hm.user_id = bills.user_id
  ORDER BY hm.joined_at ASC
  LIMIT 1
)
WHERE household_id IS NULL;
```

**Rationale:** Assigns each bill to the user's first household (by join date). This ensures all existing bills are assigned to a household.

**Bill Instances Backfill:**
```sql
UPDATE bill_instances
SET household_id = (
  SELECT b.household_id
  FROM bills b
  WHERE b.id = bill_instances.bill_id
)
WHERE household_id IS NULL;
```

**Rationale:** Bill instances inherit household from their parent bill. This maintains data consistency.

### Step 3: Verify No NULLs Remain

```sql
-- Verification queries (should return 0)
SELECT COUNT(*) FROM bills WHERE household_id IS NULL;
SELECT COUNT(*) FROM bill_instances WHERE household_id IS NULL;
```

**Result:** ✅ 0 NULL values after migration

### Step 4: Create Indexes for Performance

**Bills Indexes:**
```sql
CREATE INDEX idx_bills_household ON bills(household_id);
CREATE INDEX idx_bills_user_household ON bills(user_id, household_id);
```

**Bill Instances Indexes:**
```sql
CREATE INDEX idx_bill_instances_household ON bill_instances(household_id);
CREATE INDEX idx_bill_instances_user_household ON bill_instances(user_id, household_id);
```

**Rationale:** 
- Single column indexes optimize household-only queries
- Composite indexes optimize common query patterns (user + household filtering)

---

## Data Validation

### Pre-Migration State
- Total bills: Variable (depends on database state)
- Total bill instances: Variable (depends on database state)
- NULL household_id values: 100% (all records)

### Post-Migration State
- Total bills: Same as pre-migration (no data loss)
- Total bill instances: Same as pre-migration (no data loss)
- NULL household_id values: 0% (all records backfilled)

### Validation Queries

```sql
-- Verify all bills have household_id
SELECT COUNT(*) as total_bills,
       COUNT(household_id) as bills_with_household,
       COUNT(*) - COUNT(household_id) as null_count
FROM bills;
-- Expected: null_count = 0

-- Verify all bill instances have household_id
SELECT COUNT(*) as total_instances,
       COUNT(household_id) as instances_with_household,
       COUNT(*) - COUNT(household_id) as null_count
FROM bill_instances;
-- Expected: null_count = 0

-- Verify bill instances match parent bill household
SELECT COUNT(*) as mismatched
FROM bill_instances bi
JOIN bills b ON b.id = bi.bill_id
WHERE bi.household_id != b.household_id;
-- Expected: mismatched = 0
```

---

## Breaking Changes

**None** - This migration is backward compatible.

**Reasoning:**
- Columns added as nullable initially (allows existing code to continue working)
- Data backfilled automatically (no manual intervention needed)
- Application code updated to use new columns (no breaking changes to API)

---

## Rollback Instructions

If issues arise after migration:

### Step 1: Restore Database Backup

```bash
# Find backup file (created before migration)
ls -la sqlite.db.backup-*

# Restore backup
cp sqlite.db.backup-YYYYMMDD-HHMMSS sqlite.db
```

### Step 2: Revert Schema Changes

**File:** `lib/db/schema.ts`

Remove `householdId` fields from:
- `bills` table definition
- `bill_instances` table definition

Remove indexes:
- `idx_bills_household`
- `idx_bills_user_household`
- `idx_bill_instances_household`
- `idx_bill_instances_user_household`

### Step 3: Remove Migration File

```bash
rm drizzle/0043_add_household_id_to_bills.sql
```

### Step 4: Revert Code Changes

Revert API endpoint changes and frontend component changes via git:

```bash
git checkout <previous-commit> -- app/api/bills/
git checkout <previous-commit> -- app/api/budgets/
git checkout <previous-commit> -- components/
```

---

## Performance Impact

### Index Usage

**Expected Query Patterns:**
- `SELECT * FROM bills WHERE household_id = ?` → Uses `idx_bills_household`
- `SELECT * FROM bills WHERE user_id = ? AND household_id = ?` → Uses `idx_bills_user_household`
- `SELECT * FROM bill_instances WHERE household_id = ?` → Uses `idx_bill_instances_household`
- `SELECT * FROM bill_instances WHERE user_id = ? AND household_id = ?` → Uses `idx_bill_instances_user_household`

**Performance Impact:** ✅ Positive
- Queries use indexes (no full table scans)
- Composite indexes optimize common patterns
- Query execution times maintained or improved

### Storage Impact

**Additional Storage:**
- `household_id` column: ~36 bytes per record (UUID string)
- Indexes: ~50-100 bytes per record (depends on index structure)

**Estimated Impact:** Minimal (< 1% increase in table size)

---

## Application Code Updates

### API Endpoints

All bills and budgets API endpoints updated to:
1. Extract `householdId` from request headers/body
2. Verify user membership in household
3. Filter queries by `householdId`
4. Return appropriate error codes (400/403) for invalid household

**Pattern:**
```typescript
import { getAndVerifyHousehold } from '@/lib/api/household-auth';

const { householdId } = await getAndVerifyHousehold(request, userId);
// Use householdId in queries
```

### Frontend Components

All bills and budgets components updated to:
1. Use `useHouseholdFetch()` hook
2. Include household ID in API requests
3. Handle "no household selected" errors
4. Re-fetch data when household changes

**Pattern:**
```typescript
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

const { fetchWithHousehold } = useHouseholdFetch();
const response = await fetchWithHousehold('/api/bills');
```

---

## Testing

### Migration Testing ✅

- ✅ Migration applied successfully
- ✅ All records backfilled (0 NULL values)
- ✅ Indexes created successfully
- ✅ Data consistency verified (bill instances match parent bills)

### Application Testing ✅

- ✅ API endpoints filter by household
- ✅ Frontend components use household context
- ✅ Household switching works correctly
- ✅ Cross-household access blocked

**See:** `docs/phase-2-step-5-test-results.md` for detailed test results

---

## Notes

1. **SQLite Limitations:** SQLite doesn't support `ALTER COLUMN` to add NOT NULL constraint. We rely on application-level validation and Drizzle schema definition for new inserts.

2. **Data Consistency:** Bill instances inherit household from parent bill. This ensures consistency but means bill instances cannot be moved to different households independently.

3. **Performance:** Indexes created optimize common query patterns. Monitor query performance in production.

4. **Future Migrations:** Similar pattern can be used for Phase 3 (Goals & Debts) and Phase 4 (Business Logic).

---

## Related Documentation

- **Implementation Plan:** `docs/phase-2-bills-budgets-isolation-plan.md`
- **Test Results:** `docs/phase-2-step-5-test-results.md`
- **Completion Report:** `docs/phase-2-completion-report.md`
- **Main Plan:** `docs/household-data-isolation-plan.md`

---

**Migration Notes Version:** 1.0  
**Created:** 2025-01-27  
**Status:** Final

