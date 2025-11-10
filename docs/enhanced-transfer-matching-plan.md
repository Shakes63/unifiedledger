# Enhanced Transfer Matching Implementation Plan
## Rules Actions System - Phase 2 Priority 5

### Overview
Enhance the existing transfer conversion action with intelligent multi-factor matching, confidence scoring, and user suggestions. This improves accuracy and gives users visibility into why certain transactions were matched.

**Status:** Ready for Implementation
**Prerequisites:** Convert to Transfer Action Complete ✅
**Estimated Timeline:** 2-3 days
**Priority:** Medium-High (completes Phase 2 of Rules Actions)

---

## Current State Analysis

### What We Have (Phase 2 Priority 2 - Complete)
✅ **Convert to Transfer Action:**
- Basic transfer conversion via rules
- Simple matching logic: ±1% amount, ±7 days date, opposite type
- Auto-link with existing transactions or create new pairs
- Configurable tolerance and date range
- Account balance updates
- Full UI integration

### What's Missing
❌ **Intelligent Matching:**
- Only considers amount and date (ignores description similarity)
- No confidence scoring or explanation of matches
- Binary decision (match or no match)
- No user visibility into why transactions were matched
- No suggestions for manual review

❌ **User Experience:**
- No way to review uncertain matches before applying
- Can't see alternative match options
- No historical learning from user confirmations

---

## Architecture & Design

### Multi-Factor Scoring System

**Scoring Components (Total: 100 points)**

1. **Amount Similarity (40 points max)**
   - Exact match: 40 points
   - Within tolerance: 40 - (difference% / tolerance%) × 15
   - Outside tolerance: 0 points
   - Uses Decimal.js for precision

2. **Date Proximity (30 points max)**
   - Same day: 30 points
   - Within range: 30 - (daysDiff / dayRange) × 15
   - Outside range: 0 points

3. **Description Similarity (20 points max)**
   - Levenshtein distance comparison
   - Normalized to 0-1 scale, multiplied by 20
   - Uses existing `fastest-levenshtein` library

4. **Account Pair History (10 points max)**
   - Bonus points if accounts commonly transfer between each other
   - Based on historical transfer patterns
   - Future enhancement: ML-based scoring

**Confidence Levels:**
- **High (≥90):** Auto-link automatically
- **Medium (70-89):** Show as suggestion, require user confirmation
- **Low (<70):** Don't show, create new transfer pair

### Data Flow

```
Transaction Created with Convert to Transfer Rule
        ↓
Transfer Action Handler Invoked
        ↓
Find All Candidate Transactions
(opposite type, date range, amount range)
        ↓
Score Each Candidate
(multi-factor scoring algorithm)
        ↓
Sort by Total Score (descending)
        ↓
┌─────────────────────────────┐
│ Score ≥ 90 (High Confidence)│
│ → Auto-link immediately     │
│ → Record to audit log       │
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│ Score 70-89 (Medium)        │
│ → Store suggestion in DB    │
│ → Notify user for review    │
└─────────────────────────────┘
        ↓
┌─────────────────────────────┐
│ Score <70 (Low)             │
│ → Create new transfer pair  │
│ → No suggestion stored      │
└─────────────────────────────┘
```

---

## Implementation Tasks

### Task 1: Update Transfer Matching Algorithm (Backend)
**File:** `lib/rules/transfer-action-handler.ts`
**Estimated Time:** 3 hours

**Changes Required:**

1. **Add Multi-Factor Scoring Function:**
```typescript
interface MatchScore {
  transactionId: string;
  transaction: any;
  amountScore: number;      // 0-40
  dateScore: number;        // 0-30
  descriptionScore: number; // 0-20
  accountScore: number;     // 0-10
  totalScore: number;       // 0-100
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Score a potential transfer match using multi-factor algorithm
 */
function scoreTransferMatch(
  sourceTransaction: any,
  candidateTransaction: any,
  config: TransferConversionConfig
): MatchScore {
  // 1. Amount Score (40 points)
  const sourceAmount = new Decimal(sourceTransaction.amount);
  const candidateAmount = new Decimal(candidateTransaction.amount);
  const amountDiff = candidateAmount.minus(sourceAmount).abs();
  const toleranceAmount = sourceAmount.times(config.matchTolerance / 100);

  let amountScore = 0;
  if (amountDiff.isZero()) {
    amountScore = 40;
  } else if (amountDiff.lessThanOrEqualTo(toleranceAmount)) {
    const diffRatio = amountDiff.dividedBy(toleranceAmount).toNumber();
    amountScore = 40 - (diffRatio * 15);
  }

  // 2. Date Score (30 points)
  const sourceDate = new Date(sourceTransaction.date);
  const candidateDate = new Date(candidateTransaction.date);
  const daysDiff = Math.abs(
    (sourceDate.getTime() - candidateDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  let dateScore = 0;
  if (daysDiff === 0) {
    dateScore = 30;
  } else if (daysDiff <= config.matchDayRange) {
    const diffRatio = daysDiff / config.matchDayRange;
    dateScore = 30 - (diffRatio * 15);
  }

  // 3. Description Score (20 points)
  const descScore = calculateDescriptionSimilarity(
    sourceTransaction.description,
    candidateTransaction.description
  ) * 20;

  // 4. Account Score (10 points) - placeholder for future ML
  const accountScore = 0;

  // Calculate total
  const totalScore = amountScore + dateScore + descScore + accountScore;

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low';
  if (totalScore >= 90) {
    confidence = 'high';
  } else if (totalScore >= 70) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    transactionId: candidateTransaction.id,
    transaction: candidateTransaction,
    amountScore,
    dateScore,
    descriptionScore: descScore,
    accountScore,
    totalScore,
    confidence,
  };
}
```

2. **Add Description Similarity Helper:**
```typescript
import { distance } from 'fastest-levenshtein';

/**
 * Calculate similarity between two descriptions (0-1)
 * 1 = identical, 0 = completely different
 */
function calculateDescriptionSimilarity(desc1: string, desc2: string): number {
  if (!desc1 || !desc2) return 0;

  const str1 = desc1.toLowerCase().trim();
  const str2 = desc2.toLowerCase().trim();

  if (str1 === str2) return 1;

  const maxLen = Math.max(str1.length, str2.length);
  const levenshteinDist = distance(str1, str2);

  // Convert distance to similarity score (0-1)
  return 1 - (levenshteinDist / maxLen);
}
```

3. **Update findMatchingTransaction to Use Scoring:**
```typescript
async function findMatchingTransaction(
  userId: string,
  sourceTx: any,
  targetAccountId: string | undefined,
  config: TransferConversionConfig
): Promise<{
  bestMatch: any | null;
  allMatches: MatchScore[];
  autoLink: boolean;
}> {
  // Get all candidate transactions (existing logic)
  const candidates = await getCandidateTransactions(
    userId,
    sourceTx,
    targetAccountId,
    config
  );

  if (candidates.length === 0) {
    return { bestMatch: null, allMatches: [], autoLink: false };
  }

  // Score all candidates
  const scoredMatches = candidates.map((candidate) =>
    scoreTransferMatch(sourceTx, candidate, config)
  );

  // Sort by total score (descending)
  scoredMatches.sort((a, b) => b.totalScore - a.totalScore);

  const bestMatch = scoredMatches[0];

  // Determine if we should auto-link
  const autoLink = bestMatch.confidence === 'high';

  return {
    bestMatch: autoLink ? bestMatch.transaction : null,
    allMatches: scoredMatches,
    autoLink,
  };
}
```

4. **Update handleTransferConversion:**
```typescript
export async function handleTransferConversion(
  userId: string,
  transactionId: string,
  config: TransferConversionConfig
): Promise<{
  success: boolean;
  matchedTransactionId?: string;
  createdTransactionId?: string;
  suggestions?: MatchScore[];
  autoLinked?: boolean;
  error?: string;
}> {
  // ... existing transaction fetch logic ...

  // Search for matches with scoring
  const matchResult = await findMatchingTransaction(
    userId,
    transaction,
    config.targetAccountId,
    config
  );

  const transferId = nanoid();

  // Convert source transaction to transfer
  await db
    .update(transactions)
    .set({
      type: transaction.type === 'income' ? 'transfer_in' : 'transfer_out',
      transferId: transferId,
    })
    .where(eq(transactions.id, transactionId));

  // Handle high-confidence auto-link
  if (matchResult.autoLink && matchResult.bestMatch) {
    await db
      .update(transactions)
      .set({
        type: transaction.type === 'income' ? 'transfer_out' : 'transfer_in',
        transferId: transferId,
      })
      .where(eq(transactions.id, matchResult.bestMatch.id));

    return {
      success: true,
      matchedTransactionId: matchResult.bestMatch.id,
      autoLinked: true,
    };
  }

  // Handle medium-confidence suggestions
  const mediumMatches = matchResult.allMatches.filter(
    (m) => m.confidence === 'medium'
  );

  if (mediumMatches.length > 0) {
    // Store suggestions for user review
    // TODO: Implement transfer suggestions storage
    return {
      success: true,
      suggestions: mediumMatches,
      autoLinked: false,
    };
  }

  // No good matches - create new pair if configured
  if (config.createIfNoMatch && config.targetAccountId) {
    const newTxId = nanoid();
    const newType = transaction.type === 'income' ? 'transfer_out' : 'transfer_in';

    await db.insert(transactions).values({
      id: newTxId,
      userId: userId,
      accountId: config.targetAccountId,
      date: transaction.date,
      amount: transaction.amount,
      description: transaction.description,
      notes: `Auto-created transfer pair from rule action`,
      type: newType,
      transferId: transferId,
      createdAt: new Date().toISOString(),
    });

    await updateAccountBalances(
      userId,
      transaction.accountId,
      config.targetAccountId,
      transaction.amount,
      transaction.type
    );

    return {
      success: true,
      createdTransactionId: newTxId,
      autoLinked: false,
    };
  }

  return { success: true, autoLinked: false };
}
```

**Testing:**
- ✅ Exact amount and date match scores 70+ (40 + 30)
- ✅ Similar descriptions boost score
- ✅ High confidence (≥90) auto-links
- ✅ Medium confidence (70-89) stores suggestions
- ✅ Low confidence (<70) creates new pair
- ✅ Edge cases: empty descriptions, same amount different dates

---

### Task 2: Transfer Suggestions Database Schema
**File:** `lib/db/schema.ts`
**Estimated Time:** 1 hour

**New Table: transferSuggestions**

```typescript
export const transferSuggestions = sqliteTable(
  'transfer_suggestions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    sourceTransactionId: text('source_transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
    suggestedTransactionId: text('suggested_transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),

    // Scoring breakdown
    amountScore: real('amount_score').notNull(),
    dateScore: real('date_score').notNull(),
    descriptionScore: real('description_score').notNull(),
    accountScore: real('account_score').notNull(),
    totalScore: real('total_score').notNull(),
    confidence: text('confidence', { enum: ['high', 'medium', 'low'] }).notNull(),

    // User action tracking
    status: text('status', { enum: ['pending', 'accepted', 'rejected', 'expired'] }).default('pending'),
    reviewedAt: text('reviewed_at'),

    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdx: index('transfer_suggestions_user_idx').on(table.userId),
    sourceIdx: index('transfer_suggestions_source_idx').on(table.sourceTransactionId),
    statusIdx: index('transfer_suggestions_status_idx').on(table.status),
  })
);
```

**Migration:**
```sql
-- Migration: 00XX_add_transfer_suggestions.sql
CREATE TABLE transfer_suggestions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_transaction_id TEXT NOT NULL,
  suggested_transaction_id TEXT NOT NULL,
  amount_score REAL NOT NULL,
  date_score REAL NOT NULL,
  description_score REAL NOT NULL,
  account_score REAL NOT NULL,
  total_score REAL NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (suggested_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE INDEX transfer_suggestions_user_idx ON transfer_suggestions(user_id);
CREATE INDEX transfer_suggestions_source_idx ON transfer_suggestions(source_transaction_id);
CREATE INDEX transfer_suggestions_status_idx ON transfer_suggestions(status);
```

**Generate Migration:**
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

---

### Task 3: Transfer Suggestions Storage (Backend)
**File:** `lib/rules/transfer-action-handler.ts` (update)
**Estimated Time:** 1 hour

**Add Suggestion Storage Function:**
```typescript
import { transferSuggestions } from '@/lib/db/schema';

/**
 * Store transfer match suggestions for user review
 */
async function storeSuggestions(
  userId: string,
  sourceTransactionId: string,
  matches: MatchScore[]
): Promise<void> {
  const suggestions = matches
    .filter((m) => m.confidence === 'medium')
    .slice(0, 5) // Store top 5 suggestions
    .map((match) => ({
      id: nanoid(),
      userId,
      sourceTransactionId,
      suggestedTransactionId: match.transactionId,
      amountScore: match.amountScore,
      dateScore: match.dateScore,
      descriptionScore: match.descriptionScore,
      accountScore: match.accountScore,
      totalScore: match.totalScore,
      confidence: match.confidence,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    }));

  if (suggestions.length > 0) {
    await db.insert(transferSuggestions).values(suggestions);
  }
}
```

**Update handleTransferConversion to Call Storage:**
```typescript
// After finding medium-confidence matches
if (mediumMatches.length > 0) {
  await storeSuggestions(userId, transactionId, mediumMatches);

  return {
    success: true,
    suggestions: mediumMatches,
    autoLinked: false,
  };
}
```

---

### Task 4: Transfer Suggestions API Endpoints
**Files:**
- `app/api/transfer-suggestions/route.ts` (NEW)
- `app/api/transfer-suggestions/[id]/accept/route.ts` (NEW)
- `app/api/transfer-suggestions/[id]/reject/route.ts` (NEW)

**Estimated Time:** 2 hours

**1. GET /api/transfer-suggestions**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { db } from '@/lib/db';
import { transferSuggestions, transactions, accounts } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch suggestions with transaction and account details
    const suggestions = await db
      .select({
        suggestion: transferSuggestions,
        sourceTransaction: transactions,
        suggestedTransaction: transactions,
        sourceAccount: accounts,
        suggestedAccount: accounts,
      })
      .from(transferSuggestions)
      .leftJoin(
        transactions,
        eq(transferSuggestions.sourceTransactionId, transactions.id)
      )
      .leftJoin(
        accounts,
        eq(transactions.accountId, accounts.id)
      )
      // Additional joins for suggested transaction/account
      .where(
        and(
          eq(transferSuggestions.userId, userId),
          eq(transferSuggestions.status, status)
        )
      )
      .orderBy(desc(transferSuggestions.totalScore))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(transferSuggestions)
      .where(
        and(
          eq(transferSuggestions.userId, userId),
          eq(transferSuggestions.status, status)
        )
      );

    return NextResponse.json({
      data: suggestions,
      total: total[0]?.count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching transfer suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
```

**2. POST /api/transfer-suggestions/[id]/accept/route.ts**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { db } from '@/lib/db';
import { transferSuggestions, transactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const suggestionId = params.id;

    // Fetch suggestion
    const suggestion = await db
      .select()
      .from(transferSuggestions)
      .where(
        and(
          eq(transferSuggestions.id, suggestionId),
          eq(transferSuggestions.userId, userId)
        )
      )
      .limit(1);

    if (suggestion.length === 0) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    const sug = suggestion[0];

    // Create transfer link
    const transferId = nanoid();

    // Update both transactions to link them
    await db
      .update(transactions)
      .set({ transferId })
      .where(eq(transactions.id, sug.sourceTransactionId));

    await db
      .update(transactions)
      .set({ transferId })
      .where(eq(transactions.id, sug.suggestedTransactionId));

    // Mark suggestion as accepted
    await db
      .update(transferSuggestions)
      .set({
        status: 'accepted',
        reviewedAt: new Date().toISOString(),
      })
      .where(eq(transferSuggestions.id, suggestionId));

    return NextResponse.json({
      success: true,
      message: 'Transfer link created successfully',
    });
  } catch (error) {
    console.error('Error accepting suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to accept suggestion' },
      { status: 500 }
    );
  }
}
```

**3. POST /api/transfer-suggestions/[id]/reject/route.ts**
```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await db
      .update(transferSuggestions)
      .set({
        status: 'rejected',
        reviewedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(transferSuggestions.id, params.id),
          eq(transferSuggestions.userId, userId)
        )
      );

    return NextResponse.json({
      success: true,
      message: 'Suggestion rejected',
    });
  } catch (error) {
    console.error('Error rejecting suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to reject suggestion' },
      { status: 500 }
    );
  }
}
```

---

### Task 5: Transfer Suggestions UI Component
**File:** `components/transactions/transfer-suggestions-modal.tsx` (NEW)
**Estimated Time:** 3 hours

**Component Structure:**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, Check, X, TrendingUp, Calendar, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface MatchScore {
  transactionId: string;
  transaction: any;
  amountScore: number;
  dateScore: number;
  descriptionScore: number;
  accountScore: number;
  totalScore: number;
  confidence: 'high' | 'medium' | 'low';
}

interface TransferSuggestion {
  id: string;
  sourceTransaction: any;
  suggestedTransaction: any;
  sourceAccount: any;
  suggestedAccount: any;
  score: MatchScore;
}

export function TransferSuggestionsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [suggestions, setSuggestions] = useState<TransferSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchSuggestions();
    }
  }, [open]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/transfer-suggestions?status=pending');
      const data = await response.json();
      setSuggestions(data.data || []);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (suggestionId: string) => {
    try {
      await fetch(`/api/transfer-suggestions/${suggestionId}/accept`, {
        method: 'POST',
      });
      // Remove from list
      setSuggestions(suggestions.filter((s) => s.id !== suggestionId));
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
    }
  };

  const handleReject = async (suggestionId: string) => {
    try {
      await fetch(`/api/transfer-suggestions/${suggestionId}/reject`, {
        method: 'POST',
      });
      // Remove from list
      setSuggestions(suggestions.filter((s) => s.id !== suggestionId));
    } catch (error) {
      console.error('Failed to reject suggestion:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-[var(--color-primary)]" />
            Transfer Match Suggestions
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading suggestions...
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No pending suggestions</p>
            <p className="text-xs text-muted-foreground mt-2">
              Suggestions appear when rules find potential transfer matches
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onAccept={() => handleAccept(suggestion.id)}
                onReject={() => handleReject(suggestion.id)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: TransferSuggestion;
  onAccept: () => void;
  onReject: () => void;
}) {
  const { sourceTransaction, suggestedTransaction, sourceAccount, suggestedAccount, score } =
    suggestion;

  const getConfidenceBadge = (confidence: string, totalScore: number) => {
    if (confidence === 'high') {
      return (
        <Badge className="bg-[var(--color-success)] text-white">
          {totalScore.toFixed(0)}% Match
        </Badge>
      );
    } else if (confidence === 'medium') {
      return (
        <Badge className="bg-[var(--color-warning)] text-white">
          {totalScore.toFixed(0)}% Match
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-[var(--color-error)] text-white">
          {totalScore.toFixed(0)}% Match
        </Badge>
      );
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-elevated space-y-3">
      {/* Header with confidence badge */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Potential Transfer Match</h4>
        {getConfidenceBadge(score.confidence, score.totalScore)}
      </div>

      {/* Transaction comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Source transaction */}
        <div className="bg-card rounded-lg p-3 border border-border">
          <p className="text-xs text-muted-foreground mb-2">Source Transaction</p>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {sourceTransaction.description}
            </p>
            <p className="text-lg font-mono text-[var(--color-expense)]">
              {formatCurrency(sourceTransaction.amount)}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: sourceAccount.color }}
              />
              {sourceAccount.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(sourceTransaction.date).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
        </div>

        {/* Suggested transaction */}
        <div className="bg-card rounded-lg p-3 border border-border">
          <p className="text-xs text-muted-foreground mb-2">Suggested Match</p>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {suggestedTransaction.description}
            </p>
            <p className="text-lg font-mono text-[var(--color-income)]">
              {formatCurrency(suggestedTransaction.amount)}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: suggestedAccount.color }}
              />
              {suggestedAccount.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(suggestedTransaction.date).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="bg-card rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground mb-2">Match Breakdown</p>
        <ScoreBar label="Amount" score={score.amountScore} max={40} />
        <ScoreBar label="Date" score={score.dateScore} max={30} />
        <ScoreBar label="Description" score={score.descriptionScore} max={20} />
        {score.accountScore > 0 && (
          <ScoreBar label="History" score={score.accountScore} max={10} />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={onAccept}
          className="flex-1 bg-[var(--color-success)] hover:opacity-90 text-white"
        >
          <Check className="h-4 w-4 mr-2" />
          Link as Transfer
        </Button>
        <Button
          onClick={onReject}
          variant="outline"
          className="flex-1 border-border hover:bg-elevated"
        >
          <X className="h-4 w-4 mr-2" />
          Not a Match
        </Button>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const percentage = (score / max) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">
          {score.toFixed(1)} / {max}
        </span>
      </div>
      <div className="h-2 bg-background rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--color-primary)] transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

**Theme Integration:**
- ✅ All colors use CSS variables
- ✅ Confidence badges use semantic colors (success/warning/error)
- ✅ Lucide icons throughout (no emojis)
- ✅ Proper backgrounds (bg-card, bg-elevated)
- ✅ Border colors (border-border)
- ✅ Text colors (text-foreground, text-muted-foreground)

---

### Task 6: Dashboard Integration - Suggestions Widget
**File:** `components/dashboard/transfer-suggestions-widget.tsx` (NEW)
**Estimated Time:** 1 hour

**Small Widget for Dashboard:**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, ChevronRight } from 'lucide-react';
import { TransferSuggestionsModal } from '@/components/transactions/transfer-suggestions-modal';

export function TransferSuggestionsWidget() {
  const [count, setCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchCount();
  }, []);

  const fetchCount = async () => {
    try {
      const response = await fetch('/api/transfer-suggestions?status=pending&limit=1');
      const data = await response.json();
      setCount(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch suggestion count:', error);
    }
  };

  if (count === 0) return null;

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-[var(--color-warning)]" />
            Transfer Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {count} potential transfer {count === 1 ? 'match' : 'matches'} found
            </p>
            <Button
              onClick={() => setModalOpen(true)}
              className="w-full bg-[var(--color-warning)] hover:opacity-90 text-white"
            >
              Review Suggestions
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <TransferSuggestionsModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
```

**Add to Dashboard:**
- Import and render in `app/dashboard/page.tsx`
- Place in widgets section alongside goals/debts

---

### Task 7: Testing & Validation
**Estimated Time:** 2 hours

**Test Cases:**

**Unit Tests (lib/rules/transfer-action-handler.test.ts):**
1. ✅ scoreTransferMatch calculates correct amount score
2. ✅ scoreTransferMatch calculates correct date score
3. ✅ scoreTransferMatch calculates correct description score
4. ✅ calculateDescriptionSimilarity handles identical strings (returns 1)
5. ✅ calculateDescriptionSimilarity handles completely different strings (returns ~0)
6. ✅ calculateDescriptionSimilarity handles empty strings (returns 0)
7. ✅ High confidence (≥90) triggers auto-link
8. ✅ Medium confidence (70-89) stores suggestions
9. ✅ Low confidence (<70) creates new pair

**Integration Tests:**
1. ✅ Create transaction with transfer rule → high confidence → auto-links
2. ✅ Create transaction with transfer rule → medium confidence → stores suggestion
3. ✅ Accept suggestion → creates transfer link
4. ✅ Reject suggestion → marks as rejected
5. ✅ Multiple suggestions sorted by score

**API Tests:**
1. ✅ GET /api/transfer-suggestions returns pending suggestions
2. ✅ POST /api/transfer-suggestions/[id]/accept creates transfer link
3. ✅ POST /api/transfer-suggestions/[id]/reject marks as rejected
4. ✅ Authorization enforced on all endpoints

---

### Task 8: Documentation Updates
**Files to Update:**
- `docs/features.md` - Mark Priority 5 complete, update Phase 2 status to 100%
- `.claude/CLAUDE.md` - Add enhanced transfer matching to Phase 2 summary
- `docs/rules-actions-phase2-plan.md` - Update Priority 5 tasks as complete

**Estimated Time:** 30 minutes

---

## Success Criteria

Enhanced Transfer Matching is complete when:

- ✅ Multi-factor scoring algorithm implemented and tested
- ✅ High confidence matches (≥90) auto-link automatically
- ✅ Medium confidence matches (70-89) stored as suggestions
- ✅ Transfer suggestions API endpoints functional
- ✅ Transfer suggestions UI modal complete and themed
- ✅ Dashboard widget shows suggestion count
- ✅ Accept/reject functionality works correctly
- ✅ Description similarity using Levenshtein distance
- ✅ All tests passing (unit + integration)
- ✅ Documentation updated
- ✅ Zero TypeScript errors in production build

---

## Theme Integration Checklist

All UI components use semantic CSS variables:

- ✅ Backgrounds: `bg-card`, `bg-elevated`, `bg-background`
- ✅ Text: `text-foreground`, `text-muted-foreground`
- ✅ Borders: `border-border`
- ✅ Confidence badges: `--color-success`, `--color-warning`, `--color-error`
- ✅ Primary actions: `bg-[var(--color-primary)]`
- ✅ Icons: Lucide icons (ArrowRightLeft, Check, X, etc.)
- ✅ Transaction types: `--color-income`, `--color-expense`, `--color-transfer`

---

## Implementation Order

### Day 1: Backend Enhancement (Tasks 1-3)
1. Update transfer matching algorithm with scoring (3 hours)
2. Create database schema and migration (1 hour)
3. Add suggestion storage logic (1 hour)

### Day 2: API & Frontend (Tasks 4-6)
1. Create API endpoints (2 hours)
2. Build transfer suggestions modal (3 hours)
3. Create dashboard widget (1 hour)

### Day 3: Testing & Documentation (Tasks 7-8)
1. Write comprehensive tests (2 hours)
2. Update documentation (30 min)
3. Build verification and bug fixes (1.5 hours)

---

## Next Steps After Completion

With Enhanced Transfer Matching complete, **Phase 2 will be 100% complete**! 🎉

Next priorities:
1. Sales Tax on Income Transactions (features 6 & 7 from features.md)
2. Phase 3 enhancements (conditional actions, action chaining)
3. ML-powered account pair history scoring
4. Historical learning from user confirmations

---

## Getting Started

**Ready to implement! Let's begin with Task 1:**

```bash
# Start development server
pnpm dev

# Generate database migration (after schema changes)
pnpm drizzle-kit generate
pnpm drizzle-kit migrate

# Run tests as you build
pnpm test:watch
```

Let's enhance transfer matching! 🚀
