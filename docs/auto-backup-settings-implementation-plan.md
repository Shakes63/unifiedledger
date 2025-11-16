# Auto-Backup Settings Implementation Plan

## Overview

This plan details the implementation of automatic backup settings for Unified Ledger. This feature will allow users to configure automatic data backups on a schedule (daily, weekly, monthly) and view their backup history. Backups will use the existing export functionality to generate JSON files.

## Feature Goals

1. **User-Configurable Backup Settings:**
   - Enable/disable automatic backups
   - Select backup frequency (daily, weekly, monthly)
   - Choose backup format (JSON only initially, CSV support later)
   - Configure retention period (how many backups to keep)
   - Option to email backups (future enhancement)

2. **Backup History Management:**
   - View list of all backups with timestamps
   - Download individual backups
   - Delete old backups manually
   - Automatic cleanup based on retention settings

3. **Automatic Backup Execution:**
   - Scheduled backups based on user preferences
   - Background job execution
   - Error handling and retry logic
   - Notification on backup completion/failure

## Architecture Integration

### Database Schema

**New Table: `backup_settings`**
- Stores user-level backup preferences
- One record per user (similar to `user_settings`)
- Fields:
  - `id` (primary key)
  - `userId` (foreign key to users)
  - `enabled` (boolean, default: false)
  - `frequency` (enum: 'daily', 'weekly', 'monthly', default: 'weekly')
  - `format` (enum: 'json', 'csv', default: 'json')
  - `retentionCount` (integer, default: 10 - keep last 10 backups)
  - `emailBackups` (boolean, default: false - future feature)
  - `lastBackupAt` (timestamp, nullable)
  - `nextBackupAt` (timestamp, nullable)
  - `createdAt`, `updatedAt`

**New Table: `backup_history`**
- Stores metadata about each backup created
- Fields:
  - `id` (primary key)
  - `userId` (foreign key to users)
  - `backupSettingsId` (foreign key to backup_settings)
  - `filename` (string - generated filename)
  - `fileSize` (integer - bytes)
  - `format` (enum: 'json', 'csv')
  - `status` (enum: 'pending', 'completed', 'failed')
  - `errorMessage` (text, nullable)
  - `createdAt` (timestamp)
  - Indexes: `userId`, `createdAt`, `status`

**Storage Strategy:**
- Backups stored in `public/backups/{userId}/` directory
- Filename format: `unifiedledger-backup-{YYYY-MM-DD-HHMMSS}.json`
- Files are server-side only (not in database)
- Consider cloud storage integration in future (S3, etc.)

### API Endpoints

**1. GET `/api/user/backup-settings`**
- Returns user's backup settings
- Creates default record if doesn't exist
- Response: `{ settings: BackupSettings }`

**2. POST `/api/user/backup-settings`**
- Updates backup settings
- Validates frequency and retention values
- Calculates `nextBackupAt` based on frequency
- Response: `{ success: true, settings: BackupSettings }`

**3. GET `/api/user/backups`**
- Returns list of user's backups (paginated)
- Query params: `limit`, `offset`, `status`
- Response: `{ backups: BackupHistory[], total: number }`

**4. GET `/api/user/backups/[id]/download`**
- Downloads a specific backup file
- Validates user ownership
- Returns file with proper headers
- Response: File download

**5. DELETE `/api/user/backups/[id]`**
- Deletes a backup file and history record
- Validates user ownership
- Removes file from filesystem
- Response: `{ success: true }`

**6. POST `/api/user/backups/create`**
- Manually trigger a backup (for testing/admin)
- Creates backup immediately
- Returns backup metadata
- Response: `{ backup: BackupHistory }`

**7. POST `/api/user/backups/cleanup`**
- Manually trigger cleanup of old backups
- Removes backups exceeding retention count
- Response: `{ deleted: number }`

### Cron Job / Scheduled Task

**New File: `lib/backups/backup-scheduler.ts`**
- Function to check all users with backups enabled
- For each user, check if `nextBackupAt` has passed
- Trigger backup creation
- Update `nextBackupAt` for next scheduled backup
- Handle errors gracefully

**Integration with Existing Cron System:**
- Add to existing cron job infrastructure
- Run every hour (check if backup needed)
- Or run daily at 2 AM UTC (more efficient)

**New Cron Endpoint: `/api/cron/backups`**
- Protected endpoint (requires cron secret)
- Calls backup scheduler
- Returns summary of backups created

### Frontend Components

**1. Update `components/settings/data-tab.tsx`**
- Add new "Automatic Backups" section
- Toggle to enable/disable backups
- Frequency selector (daily/weekly/monthly)
- Retention count input
- Display next backup time
- Link to backup history

**2. New Component: `components/settings/backup-history.tsx`**
- Table/list of backups
- Columns: Date, Size, Format, Status, Actions
- Download button for each backup
- Delete button for each backup
- Empty state when no backups
- Loading states

**3. New Component: `components/settings/backup-settings-form.tsx`**
- Form for backup settings
- Validation
- Auto-save on change
- Success/error toasts

### UI/UX Design

**Location:** Data Management tab (`/dashboard/settings?section=household&tab=household-data`)

**Section Layout:**
```
Data Management Tab
├── Data Retention (existing)
├── Import Preferences (existing)
├── Cache Management (existing)
├── Automatic Backups (NEW)
│   ├── Enable/Disable Toggle
│   ├── Frequency Selector
│   ├── Retention Count Input
│   ├── Next Backup Time Display
│   └── View Backup History Link
└── Danger Zone (existing)
```

**Backup History Modal/Dialog:**
- Opens from "View Backup History" link
- Shows list of backups in chronological order (newest first)
- Each row: Date, Size (formatted), Format badge, Status badge, Actions
- Download button (triggers download)
- Delete button (with confirmation)
- Empty state: "No backups yet. Your first backup will appear here."

**Styling:**
- Use semantic theme variables throughout
- `bg-card`, `bg-elevated`, `border-border`
- `text-foreground`, `text-muted-foreground`
- Status badges: `bg-[var(--color-success)]`, `bg-[var(--color-error)]`, `bg-[var(--color-warning)]`
- Consistent with existing Data Management tab styling

## Implementation Steps

### Step 1: Database Schema & Migration

**Tasks:**
1. Add `backup_settings` table to `lib/db/schema.ts`
2. Add `backup_history` table to `lib/db/schema.ts`
3. Create migration file `drizzle/0046_add_backup_tables.sql`
4. Run migration: `pnpm drizzle-kit generate` and `pnpm drizzle-kit migrate`
5. Verify migration success

**Files to Modify:**
- `lib/db/schema.ts` - Add table definitions
- `drizzle/0046_add_backup_tables.sql` - Migration file (auto-generated)

**Validation:**
- Tables created successfully
- Indexes created
- Default values set correctly

### Step 2: Backup Settings API

**Tasks:**
1. Create `app/api/user/backup-settings/route.ts`
2. Implement GET endpoint (returns settings, creates defaults if needed)
3. Implement POST endpoint (updates settings, validates input)
4. Add validation for frequency and retention values
5. Calculate `nextBackupAt` based on frequency
6. Add error handling

**Files to Create:**
- `app/api/user/backup-settings/route.ts`

**Validation:**
- GET returns default settings for new users
- POST updates settings correctly
- Validation rejects invalid values
- `nextBackupAt` calculated correctly

### Step 3: Backup History API

**Tasks:**
1. Create `app/api/user/backups/route.ts` (GET list)
2. Create `app/api/user/backups/[id]/download/route.ts` (GET download)
3. Create `app/api/user/backups/[id]/route.ts` (DELETE)
4. Create `app/api/user/backups/create/route.ts` (POST manual backup)
5. Create `app/api/user/backups/cleanup/route.ts` (POST cleanup)
6. Implement file storage in `public/backups/{userId}/`
7. Add user ownership validation
8. Add error handling

**Files to Create:**
- `app/api/user/backups/route.ts`
- `app/api/user/backups/[id]/download/route.ts`
- `app/api/user/backups/[id]/route.ts`
- `app/api/user/backups/create/route.ts`
- `app/api/user/backups/cleanup/route.ts`

**Helper Functions:**
- `lib/backups/backup-utils.ts` - File operations, filename generation
- Reuse existing export logic from `app/api/user/export/route.ts`

**Validation:**
- List endpoint returns paginated backups
- Download endpoint serves file correctly
- Delete endpoint removes file and record
- Manual backup creates backup successfully
- Cleanup removes old backups correctly
- User ownership validated on all endpoints

### Step 4: Backup Scheduler

**Tasks:**
1. Create `lib/backups/backup-scheduler.ts`
2. Implement function to check users needing backups
3. Implement backup creation logic
4. Update `nextBackupAt` after backup
5. Handle errors and retries
6. Create cron endpoint `/api/cron/backups`
7. Add logging

**Files to Create:**
- `lib/backups/backup-scheduler.ts`
- `app/api/cron/backups/route.ts`

**Integration:**
- Use existing cron infrastructure
- Check if cron secret is configured
- Schedule to run daily at 2 AM UTC (or hourly)

**Validation:**
- Scheduler finds users needing backups
- Backups created successfully
- `nextBackupAt` updated correctly
- Errors handled gracefully

### Step 5: Frontend - Backup Settings Form

**Tasks:**
1. Create `components/settings/backup-settings-form.tsx`
2. Add form fields: enabled toggle, frequency selector, retention input
3. Fetch settings on mount
4. Auto-save on change
5. Display next backup time
6. Add loading and error states
7. Use semantic theme variables

**Files to Create:**
- `components/settings/backup-settings-form.tsx`

**Validation:**
- Form loads settings correctly
- Changes save successfully
- Next backup time displays correctly
- Error states handled

### Step 6: Frontend - Backup History Component

**Tasks:**
1. Create `components/settings/backup-history.tsx`
2. Fetch backup list on mount
3. Display backups in table/list
4. Implement download functionality
5. Implement delete with confirmation
6. Add empty state
7. Add loading states
8. Use semantic theme variables

**Files to Create:**
- `components/settings/backup-history.tsx`

**Validation:**
- List displays correctly
- Download works
- Delete works with confirmation
- Empty state shows when no backups
- Loading states work

### Step 7: Integrate into Data Management Tab

**Tasks:**
1. Update `components/settings/data-tab.tsx`
2. Add "Automatic Backups" section
3. Import and render `BackupSettingsForm`
4. Add "View Backup History" link/button
5. Create dialog/modal for backup history
6. Add separator between sections
7. Ensure consistent styling

**Files to Modify:**
- `components/settings/data-tab.tsx`

**Validation:**
- Section appears in correct location
- Form works correctly
- History modal opens/closes correctly
- Styling consistent with existing sections

### Step 8: Testing & Validation

**Tasks:**
1. Test backup settings creation and updates
2. Test manual backup creation
3. Test automatic backup scheduling
4. Test backup download
5. Test backup deletion
6. Test cleanup functionality
7. Test error scenarios
8. Test UI interactions
9. Verify theme integration
10. Test on mobile devices

**Test Cases:**
- New user: Default settings created
- Enable backups: Settings saved, next backup calculated
- Change frequency: Next backup recalculated
- Manual backup: Backup created, appears in history
- Download backup: File downloads correctly
- Delete backup: File and record removed
- Cleanup: Old backups removed based on retention
- Disable backups: No backups created
- Error handling: Graceful error messages

### Step 9: Documentation & Cleanup

**Tasks:**
1. Update `docs/features.md` to mark feature as complete
2. Add API documentation comments
3. Update project status documentation
4. Code review and cleanup
5. Remove any debug logs
6. Optimize queries if needed

## Technical Considerations

### File Storage

**Option 1: Local Filesystem (Initial Implementation)**
- Store in `public/backups/{userId}/`
- Simple to implement
- Requires server disk space
- Not scalable for large deployments

**Option 2: Cloud Storage (Future Enhancement)**
- S3, Google Cloud Storage, etc.
- Scalable
- Requires additional configuration
- More complex implementation

**Decision:** Start with local filesystem, design for easy migration to cloud storage later.

### Backup Format

**Current:** JSON (reuse existing export endpoint)
**Future:** CSV support, compressed backups (.zip)

### Security

- Validate user ownership on all endpoints
- Sanitize filenames
- Rate limit backup creation
- Secure file storage (not publicly accessible)
- Consider encryption for sensitive data

### Performance

- Backups run in background (async)
- Large datasets: Consider streaming/chunking
- Index `backup_history` table properly
- Cleanup runs periodically, not on every backup

### Error Handling

- Retry logic for failed backups
- Error messages stored in `backup_history.errorMessage`
- User notifications on failure (future)
- Logging for debugging

## Success Criteria

1. ✅ Users can enable/disable automatic backups
2. ✅ Users can configure backup frequency
3. ✅ Users can set retention count
4. ✅ Backups are created automatically on schedule
5. ✅ Users can view backup history
6. ✅ Users can download backups
7. ✅ Users can delete backups
8. ✅ Old backups are cleaned up automatically
9. ✅ Manual backup creation works
10. ✅ All UI uses semantic theme variables
11. ✅ Mobile-responsive design
12. ✅ Error handling works correctly
13. ✅ Documentation updated

## Future Enhancements

1. **Email Backups:** Send backups via email
2. **Cloud Storage:** Support S3, Google Cloud Storage
3. **Compression:** Compress backups (.zip, .gz)
4. **CSV Format:** Support CSV backup format
5. **Incremental Backups:** Only backup changes
6. **Backup Encryption:** Encrypt backup files
7. **Backup Notifications:** Email/SMS on backup completion
8. **Backup Verification:** Verify backup integrity
9. **Restore Functionality:** Restore from backup
10. **Backup Scheduling:** More granular scheduling (specific days/times)

## Timeline Estimate

- **Step 1:** Database Schema - 1 hour
- **Step 2:** Backup Settings API - 2 hours
- **Step 3:** Backup History API - 4 hours
- **Step 4:** Backup Scheduler - 3 hours
- **Step 5:** Backup Settings Form - 2 hours
- **Step 6:** Backup History Component - 3 hours
- **Step 7:** Data Tab Integration - 1 hour
- **Step 8:** Testing & Validation - 3 hours
- **Step 9:** Documentation - 1 hour

**Total Estimate:** ~20 hours (2.5 days)

## Dependencies

- Existing export functionality (`/api/user/export`)
- Existing cron infrastructure
- Existing settings API pattern
- Existing UI components (Button, Card, Dialog, etc.)
- Semantic theme variables

## Risks & Mitigation

**Risk 1: File Storage Limitations**
- **Mitigation:** Start with local storage, design for cloud migration

**Risk 2: Large Backup Files**
- **Mitigation:** Consider compression, streaming for large datasets

**Risk 3: Backup Failures**
- **Mitigation:** Error handling, retry logic, user notifications

**Risk 4: Performance Impact**
- **Mitigation:** Run backups in background, schedule off-peak hours

**Risk 5: Security Concerns**
- **Mitigation:** Validate user ownership, secure file storage, rate limiting

---

**Document Version:** 1.0  
**Created:** 2025-01-27  
**Status:** Ready for Implementation  
**Priority:** Medium

