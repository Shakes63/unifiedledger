# Backup Household Isolation Implementation Plan

## Overview

Currently, backups are created per-user and include all user data across all households. This plan implements household isolation for backups, ensuring each backup only contains data from a specific household.

## Current State

### Database Schema
- `backup_settings` - No `household_id` field (user-level only)
- `backup_history` - No `household_id` field (user-level only)
- Backup creation queries don't filter by `household_id`

### Current Backup Flow
1. User enables backups (one setting per user)
2. Scheduler creates backup for user (includes all households)
3. Backup file stored in `backups/{userId}/`
4. Backup history shows all backups for user

## Target State

### Database Schema Changes
- `backup_settings` - Add `household_id` field (make it per-household)
- `backup_history` - Add `household_id` field (track which household was backed up)
- Update indexes to include `household_id`

### Backup Flow Changes
1. User enables backups per household (one setting per household)
2. Scheduler creates backup per household (only that household's data)
3. Backup file stored in `backups/{userId}/{householdId}/`
4. Backup history filtered by household

## Implementation Steps

### Step 1: Database Schema Migration

**Tasks:**
1. Add `household_id` to `backup_settings` table
2. Add `household_id` to `backup_history` table
3. Update unique constraint on `backup_settings` to be `(user_id, household_id)`
4. Add indexes for household queries
5. Create migration file
6. Backfill existing data (assign to user's first/default household)

**Migration File:** `drizzle/0047_add_household_id_to_backups.sql`

**Schema Changes:**
```sql
-- Add household_id to backup_settings
ALTER TABLE backup_settings ADD COLUMN household_id TEXT;
CREATE INDEX idx_backup_settings_household ON backup_settings(user_id, household_id);
-- Update unique constraint (remove old, add new)
CREATE UNIQUE INDEX idx_backup_settings_user_household ON backup_settings(user_id, household_id);

-- Add household_id to backup_history
ALTER TABLE backup_history ADD COLUMN household_id TEXT;
CREATE INDEX idx_backup_history_household ON backup_history(user_id, household_id);
CREATE INDEX idx_backup_history_user_household_created ON backup_history(user_id, household_id, created_at);
```

**Backfill Strategy:**
- For each user with backup_settings, find their first/default household
- Set `household_id` to that household's ID
- For backup_history, set `household_id` to user's first household (or NULL if no household)

### Step 2: Update Backup Creation Function

**File:** `lib/backups/create-backup.ts`

**Changes:**
1. Add `householdId` parameter to `createUserBackup()`
2. Filter all data queries by `householdId` (using `and(eq(table.userId, userId), eq(table.householdId, householdId))`)
3. Update backup file path to include `householdId`: `backups/{userId}/{householdId}/`
4. Store `householdId` in backup_history record
5. Update backup_settings query to include `householdId`

**Data to Filter by Household:**
- ✅ transactions (has household_id)
- ✅ accounts (has household_id)
- ✅ budgetCategories (has household_id)
- ✅ bills (has household_id)
- ✅ savingsGoals (has household_id)
- ✅ debts (has household_id)
- ✅ categorizationRules (has household_id)
- ✅ merchants (has household_id)
- ✅ tags (has household_id) - Note: tags might be user-level, check schema
- ✅ customFields (has household_id) - Check schema
- ✅ transactionTemplates (check if has household_id)
- ✅ budgetPeriods (check if has household_id)
- ✅ transactionSplits (has household_id)
- ✅ billInstances (has household_id)
- ✅ savingsMilestones (check if has household_id)
- ✅ debtPayments (check if has household_id)
- ✅ transactionTags (check if has household_id)
- ✅ customFieldValues (check if has household_id)
- ❌ userSettings (user-level, not household-specific)

**Note:** Some tables might not have `household_id`. Need to check schema and either:
- Add `household_id` if it should be household-scoped
- Keep user-level if it's truly user-specific

### Step 3: Update Backup Settings API

**File:** `app/api/user/backup-settings/route.ts`

**Changes:**
1. Add `householdId` parameter (from request body or query)
2. Use `getAndVerifyHousehold()` helper to get and verify household
3. Update queries to filter by `household_id`
4. Update unique constraint check to include `household_id`

**New Endpoint Structure:**
- Option A: `/api/user/backup-settings?householdId={id}` (query param)
- Option B: `/api/households/[householdId]/backup-settings` (RESTful)
- Option C: Keep `/api/user/backup-settings` but require `householdId` in body

**Decision:** Option C - Keep existing endpoint, require `householdId` in request body (consistent with other endpoints)

### Step 4: Update Backup History API

**File:** `app/api/user/backups/route.ts` and related endpoints

**Changes:**
1. Add `householdId` parameter to all endpoints
2. Filter backup_history queries by `household_id`
3. Update file path resolution to include `householdId`
4. Verify user has access to household before returning backups

**Endpoints to Update:**
- `GET /api/user/backups` - List backups (filter by household)
- `GET /api/user/backups/[id]/download` - Download backup (verify household)
- `DELETE /api/user/backups/[id]` - Delete backup (verify household)
- `POST /api/user/backups/create` - Create backup (require household)
- `POST /api/user/backups/cleanup` - Cleanup backups (filter by household)

### Step 5: Update Backup Scheduler

**File:** `lib/backups/backup-scheduler.ts`

**Changes:**
1. Query `backup_settings` grouped by `(user_id, household_id)`
2. For each user-household pair needing backup:
   - Call `createUserBackup(userId, format, householdId)`
   - Update `backup_settings` for that specific household
3. Update `processScheduledBackups()` to handle multiple households per user

**Logic:**
- User can have backups enabled for multiple households
- Each household has its own backup schedule
- Scheduler processes each household independently

### Step 6: Update Backup Utilities

**File:** `lib/backups/backup-utils.ts`

**Changes:**
1. Update `getUserBackupDir()` to `getHouseholdBackupDir(userId, householdId)`
2. Update `ensureBackupDir()` to create household-specific directory
3. Update file path functions to include `householdId`

**New Path Structure:**
- Old: `backups/{userId}/filename.json`
- New: `backups/{userId}/{householdId}/filename.json`

### Step 7: Update Frontend Components

**Files:**
- `components/settings/backup-settings-form.tsx`
- `components/settings/backup-history.tsx`
- `components/settings/data-tab.tsx`

**Changes:**
1. Get `householdId` from household context
2. Pass `householdId` in API calls
3. Filter backup history by current household
4. Show household name in backup history UI
5. Update file paths to include household

### Step 8: Update Manual Backup Endpoint

**File:** `app/api/user/backups/create/route.ts`

**Changes:**
1. Require `householdId` in request body
2. Verify user has access to household
3. Pass `householdId` to `createUserBackup()`

### Step 9: Testing

**Test Cases:**
1. Create backup for household A (verify only household A data included)
2. Create backup for household B (verify only household B data included)
3. Verify backup files stored in correct directories
4. Verify backup history filtered by household
5. Verify scheduler creates backups for multiple households
6. Verify user can't access backups from households they're not a member of

## Technical Considerations

### Data Filtering

**Tables with `household_id`:**
- transactions ✅
- accounts ✅
- budgetCategories ✅
- bills ✅
- savingsGoals ✅
- debts ✅
- categorizationRules ✅
- merchants ✅
- transactionSplits ✅
- billInstances ✅

**Tables to Check:**
- tags - Check if has household_id
- customFields - Check if has household_id
- transactionTemplates - Check if has household_id
- budgetPeriods - Check if has household_id
- savingsMilestones - Check if has household_id
- debtPayments - Check if has household_id
- transactionTags - Check if has household_id
- customFieldValues - Check if has household_id

**Tables without `household_id` (user-level):**
- userSettings (user-level settings)

### File Storage

**Current:** `backups/{userId}/filename.json`
**New:** `backups/{userId}/{householdId}/filename.json`

**Migration:**
- Existing backups can stay in old location
- New backups go to new location
- Or migrate existing backups to new structure

### Backward Compatibility

**Option 1:** Support both old and new format
- Check if `householdId` provided
- If not, use old behavior (all households)
- Deprecate old behavior over time

**Option 2:** Require `householdId` immediately
- Breaking change
- Simpler implementation
- More secure (explicit household)

**Decision:** Option 2 - Require `householdId` immediately (cleaner, more secure)

### Scheduler Behavior

**Current:** One backup per user (all households)
**New:** One backup per user-household pair

**Example:**
- User has 2 households (A and B)
- Both have backups enabled
- Scheduler creates 2 backups (one for A, one for B)

## Migration Strategy

### Phase 1: Schema Update
1. Add `household_id` columns
2. Backfill existing data
3. Add indexes

### Phase 2: Code Update
1. Update backup creation function
2. Update API endpoints
3. Update scheduler
4. Update utilities

### Phase 3: Frontend Update
1. Update components to use household context
2. Update UI to show household-specific backups

### Phase 4: Testing & Validation
1. Test backup creation per household
2. Test scheduler with multiple households
3. Verify data isolation
4. Test file storage

## Success Criteria

1. ✅ Backups only contain data from specified household
2. ✅ Backup settings are per-household
3. ✅ Backup history filtered by household
4. ✅ Scheduler creates backups per household
5. ✅ File storage organized by household
6. ✅ Users can only access backups from their households
7. ✅ UI shows household-specific backups
8. ✅ Migration preserves existing backups

## Timeline Estimate

- **Step 1:** Database Migration - 1 hour
- **Step 2:** Backup Creation Function - 2 hours
- **Step 3:** Backup Settings API - 1 hour
- **Step 4:** Backup History API - 2 hours
- **Step 5:** Backup Scheduler - 2 hours
- **Step 6:** Backup Utilities - 1 hour
- **Step 7:** Frontend Components - 2 hours
- **Step 8:** Manual Backup Endpoint - 1 hour
- **Step 9:** Testing - 2 hours

**Total:** ~14 hours (1.75 days)

---

**Document Version:** 1.0  
**Created:** 2025-11-16  
**Status:** Ready for Implementation  
**Priority:** High

