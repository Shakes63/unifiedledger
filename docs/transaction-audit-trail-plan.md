# Transaction History/Audit Trail Implementation Plan

## Overview
Implement a comprehensive audit trail system for transactions that tracks all modifications, showing who made changes, what changed, and when.

## Current State Analysis

### Existing Infrastructure
- **householdActivityLog table**: Logs basic activity types (transaction_created, transaction_updated, transaction_deleted) but doesn't store field-level changes
- **Transaction Details component**: Shows createdAt/updatedAt timestamps but no change history
- **Transaction History page** (`/dashboard/transaction-history`): Shows past transactions for "repeat" functionality, not audit trails
- **activity-logger.ts**: Utility for logging to householdActivityLog

### Gap
No field-level change tracking exists. When a transaction is updated, we know it was updated but not what fields changed.

---

## Implementation Plan

### Phase 1: Database Schema (Step 1)

**Create new `transaction_audit_log` table:**

```typescript
export const transactionAuditLog = sqliteTable(
  'transaction_audit_log',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id').notNull(),
    userId: text('user_id').notNull(),
    householdId: text('household_id').notNull(),
    userName: text('user_name'), // Denormalized for display
    actionType: text('action_type', {
      enum: ['created', 'updated', 'deleted'],
    }).notNull(),
    // Field-level changes stored as JSON
    changes: text('changes'), // JSON: { field: { oldValue, newValue } }
    // Snapshot of key data before change (for deleted transactions)
    snapshot: text('snapshot'), // JSON: full transaction state
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: text('created_at').default(new Date().toISOString()),
  },
  (table) => ({
    transactionIdIdx: index('idx_transaction_audit_log_transaction').on(table.transactionId),
    userIdIdx: index('idx_transaction_audit_log_user').on(table.userId),
    householdIdIdx: index('idx_transaction_audit_log_household').on(table.householdId),
    createdAtIdx: index('idx_transaction_audit_log_created').on(table.createdAt),
    txCreatedIdx: index('idx_transaction_audit_log_tx_created').on(table.transactionId, table.createdAt),
  })
);
```

**Migration file:** `drizzle/0043_add_transaction_audit_log.sql`

---

### Phase 2: Audit Logger Utility (Step 2)

**Create `lib/transactions/audit-logger.ts`:**

```typescript
import { db } from '@/lib/db';
import { transactionAuditLog } from '@/lib/db/schema';
import { nanoid } from 'nanoid';

interface TransactionChange {
  field: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
  oldDisplayValue?: string; // For foreign keys (e.g., category name)
  newDisplayValue?: string;
}

interface AuditLogParams {
  transactionId: string;
  userId: string;
  householdId: string;
  userName?: string;
  actionType: 'created' | 'updated' | 'deleted';
  changes?: TransactionChange[];
  snapshot?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logTransactionAudit(params: AuditLogParams): Promise<void> {
  try {
    await db.insert(transactionAuditLog).values({
      id: nanoid(),
      transactionId: params.transactionId,
      userId: params.userId,
      householdId: params.householdId,
      userName: params.userName,
      actionType: params.actionType,
      changes: params.changes ? JSON.stringify(params.changes) : null,
      snapshot: params.snapshot ? JSON.stringify(params.snapshot) : null,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    // Non-fatal: don't break main operation
    console.error('Failed to log transaction audit:', error);
  }
}

export function detectChanges(
  oldTransaction: Record<string, unknown>,
  newTransaction: Record<string, unknown>,
  displayNames?: Record<string, { old?: string; new?: string }>
): TransactionChange[] {
  const trackedFields = [
    'accountId',
    'categoryId',
    'merchantId',
    'date',
    'amount',
    'description',
    'notes',
    'type',
    'isPending',
    'isTaxDeductible',
    'isSalesTaxable',
    'billId',
    'debtId',
  ];

  const changes: TransactionChange[] = [];

  for (const field of trackedFields) {
    const oldValue = oldTransaction[field] ?? null;
    const newValue = newTransaction[field] ?? null;

    // Normalize for comparison
    const oldNormalized = normalizeValue(oldValue);
    const newNormalized = normalizeValue(newValue);

    if (oldNormalized !== newNormalized) {
      changes.push({
        field,
        oldValue: oldValue as string | number | boolean | null,
        newValue: newValue as string | number | boolean | null,
        oldDisplayValue: displayNames?.[field]?.old,
        newDisplayValue: displayNames?.[field]?.new,
      });
    }
  }

  return changes;
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  return String(value);
}
```

---

### Phase 3: Update Transaction API Endpoints (Step 3)

**Modify `app/api/transactions/[id]/route.ts` PUT method:**

1. Before updating, capture current transaction state
2. After update, detect which fields changed
3. Fetch display names for foreign keys (account, category, merchant)
4. Call audit logger

**Modify `app/api/transactions/[id]/route.ts` DELETE method:**

1. Before deleting, capture full transaction snapshot
2. Log deletion with snapshot

**Modify `app/api/transactions/route.ts` POST method:**

1. After creating, log creation with initial values

---

### Phase 4: Audit History API Endpoint (Step 4)

**Create `app/api/transactions/[id]/audit/route.ts`:**

```typescript
// GET /api/transactions/{id}/audit
// Returns paginated audit history for a transaction
// Response: {
//   data: AuditLogEntry[],
//   total: number,
//   limit: number,
//   offset: number
// }
```

---

### Phase 5: Audit Trail UI Component (Step 5)

**Create `components/transactions/transaction-audit-log.tsx`:**

- Timeline view showing changes
- Expandable entries showing before/after values
- User avatars and names
- Relative timestamps with full date on hover
- Loading and empty states

**UI Design:**

```
┌─────────────────────────────────────────────────────────────┐
│ Change History                                               │
├─────────────────────────────────────────────────────────────┤
│ ○─── Today at 2:30 PM · John Doe                            │
│ │    Updated transaction                                     │
│ │    • Amount: $50.00 → $75.00                              │
│ │    • Category: Groceries → Dining Out                     │
│ │                                                            │
│ ○─── Yesterday at 10:15 AM · Jane Smith                     │
│ │    Updated transaction                                     │
│ │    • Description: "Coffee" → "Morning Coffee at Starbucks"│
│ │                                                            │
│ ●─── Nov 28, 2025 at 9:00 AM · John Doe                     │
│      Created transaction                                     │
│      Initial values:                                         │
│      • Amount: $50.00                                        │
│      • Account: Main Checking                                │
│      • Category: Groceries                                   │
└─────────────────────────────────────────────────────────────┘
```

---

### Phase 6: Integration (Step 6)

**Update `components/transactions/transaction-details.tsx`:**

1. Add collapsible "Change History" section at the bottom
2. Lazy-load audit data when section is expanded
3. Show count badge with number of changes

---

## File Changes Summary

### New Files
1. `drizzle/0043_add_transaction_audit_log.sql` - Migration
2. `lib/transactions/audit-logger.ts` - Audit logging utility
3. `app/api/transactions/[id]/audit/route.ts` - Audit history API
4. `components/transactions/transaction-audit-log.tsx` - UI component

### Modified Files
1. `lib/db/schema.ts` - Add transactionAuditLog table definition
2. `app/api/transactions/[id]/route.ts` - Add audit logging to PUT/DELETE
3. `app/api/transactions/route.ts` - Add audit logging to POST
4. `components/transactions/transaction-details.tsx` - Integrate audit trail

---

## Type Definitions

```typescript
// Add to lib/types/index.ts or create lib/types/audit.ts

export interface TransactionAuditEntry {
  id: string;
  transactionId: string;
  userId: string;
  householdId: string;
  userName: string | null;
  actionType: 'created' | 'updated' | 'deleted';
  changes: TransactionChange[] | null;
  snapshot: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface TransactionChange {
  field: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
  oldDisplayValue?: string;
  newDisplayValue?: string;
}
```

---

## Testing Considerations

1. **Unit tests for detectChanges function** - Verify correct change detection
2. **Integration tests for audit logging** - Verify logs are created correctly
3. **Manual testing** - Create, edit, delete transactions and verify audit trail

---

## Security & Privacy

1. IP addresses and user agents are optional - can be excluded for privacy
2. Audit logs are scoped to household - users can only see logs for their household's transactions
3. Deleted transaction snapshots allow data recovery if needed

---

## Performance Considerations

1. Audit logging is fire-and-forget (non-blocking)
2. Audit history API is paginated
3. Indexes on transactionId, householdId, and createdAt for efficient queries
4. Audit trail component lazy-loads data when expanded

---

## Implementation Order

1. ✅ Create implementation plan (this document)
2. Add database schema and migration
3. Create audit logger utility
4. Update transaction API endpoints
5. Create audit history API endpoint
6. Create audit trail UI component
7. Integrate into transaction details page
8. Test end-to-end

---

## Estimated Effort

- **Phase 1 (Schema):** 15 minutes
- **Phase 2 (Utility):** 30 minutes
- **Phase 3 (API Updates):** 45 minutes
- **Phase 4 (Audit API):** 20 minutes
- **Phase 5 (UI Component):** 45 minutes
- **Phase 6 (Integration):** 20 minutes
- **Testing:** 30 minutes

**Total:** ~3-4 hours



