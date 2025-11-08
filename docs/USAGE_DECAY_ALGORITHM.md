# Usage Decay Algorithm

## Overview

The usage decay algorithm keeps recommendations fresh by gradually reducing the weight of older usage data. This prevents stale recommendations and ensures that the app learns from current user behavior while acknowledging historical patterns.

**Why it matters:**
- Users' preferences change over time
- Old spending patterns can mislead recommendations
- Recent activity should influence suggestions more heavily
- Seasonal variations need gradual transitions

## How It Works

### Core Concept

Each item (account, category, merchant, tag) has a usage score. The decay algorithm reduces this score based on how long ago the item was last used.

```
Current Score = Original Score × Decay Factor × Recency Bonus
```

### Three Decay Strategies

#### 1. Time-Weighted Decay
**Best for:** General purpose, moderate change frequency

Linear decay: Score diminishes proportionally to time.

```
Formula: score = original × (1 - (daysOld / halfLifeDays))
```

**Example:** With 60-day half-life:
- 0 days old: 100% of score
- 30 days old: 50% of score
- 60 days old: 0% of score
- 90+ days old: Minimum score (0.5)

**Characteristics:**
- Predictable, easy to understand
- Linear relationship between age and decay
- Reaches minimum at half-life point

---

#### 2. Exponential Decay
**Best for:** Slowly changing patterns (accounts, transfers)

Score diminishes exponentially with time (like radioactive decay).

```
Formula: score = original × (decayRate ^ (daysOld / halfLifeDays))
```

**Example:** With 90-day half-life and 0.95 decay rate:
- 0 days old: 100% of score
- 45 days old: 97.5% of score
- 90 days old: 95% of score
- 180 days old: 90% of score
- 365 days old: 74% of score

**Characteristics:**
- Very gentle decay initially
- Accelerates slightly over time
- Older items never fully disappear
- Good for established patterns

---

#### 3. Recency Bonus
**Best for:** Dynamic patterns (merchants, quick-changing preferences)

Combines exponential decay with bonus multiplier for recent usage.

```
Formula: score = original × (decayRate ^ age) × recencyBonus
```

**Recency bonus:**
- Within 7 days: 2× multiplier
- 7-14 days: gradually from 2× to 1×
- 14+ days: normal decay

**Example:** With 30-day half-life:
- Used today: 100% × 2× = 200%
- Used 7 days ago: 50% × 2× = 100%
- Used 14 days ago: 35% × 1.3× = 45%
- Used 30 days ago: 25% × 1.0× = 25%

**Characteristics:**
- Aggressive boost for recent usage
- Creates clear preference shifts
- Good for capturing trend changes
- Responsive to user behavior changes

---

## Default Configurations

### Accounts (Slow Decay)
```
Strategy: Exponential
Half-Life: 90 days
Decay Rate: 95%
Recency Bonus: 1.5× (within 7 days)
Min Score: 1
```

**Why:** Main accounts are used regularly. Slow decay prevents over-adapting to temporary usage patterns.

### Categories (Medium Decay)
```
Strategy: Time-Weighted
Half-Life: 60 days
Decay Rate: 92%
Recency Bonus: 1.3× (within 14 days)
Min Score: 0.5
```

**Why:** Spending categories change seasonally. Medium decay allows gradual transitions.

### Merchants (Fast Decay)
```
Strategy: Recency-Bonus
Half-Life: 30 days
Decay Rate: 85%
Recency Bonus: 2× (within 7 days)
Min Score: 0.1
```

**Why:** Merchant preferences change frequently. Fast decay with strong bonus captures trends.

### Tags (Medium Decay)
```
Strategy: Exponential
Half-Life: 45 days
Decay Rate: 93%
Recency Bonus: 1.4× (within 7 days)
Min Score: 0.5
```

**Why:** Tag usage varies with projects. Medium decay with slight bonus balances consistency.

### Transfers (Slow Decay)
```
Strategy: Exponential
Half-Life: 120 days
Decay Rate: 96%
Recency Bonus: 1.2× (within 30 days)
Min Score: 1
```

**Why:** Transfer patterns are very consistent. Very slow decay with long bonus window.

## Implementation

### API Endpoint

**Trigger decay calculation:**
```bash
POST /api/cron/usage-decay \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Get decay report:**
```bash
GET /api/cron/usage-decay/report?type=merchants
```

### Core Functions

```typescript
import {
  applyUsageDecay,
  applyBatchDecay,
  calculateDecayImpact,
  generateDecayReport,
  getDecayConfigByType,
} from "@/lib/analytics/usage-decay";

// Apply decay to single item
const newScore = applyUsageDecay(
  100,                                    // original score
  new Date(Date.now() - 7 * 24 * 60 * 1000), // last used date
  getDecayConfigByType("merchants")      // config
);

// Apply decay to batch
const results = applyBatchDecay(
  items,                              // array of { id, usageCount, lastUsedAt }
  getDecayConfigByType("categories")  // config
);

// Get impact statistics
const impact = calculateDecayImpact(items, config);
// Returns: { itemsAffected, totalScoreChange, averageDecayPercentage, ... }

// Generate report
const report = generateDecayReport(items, config, "merchants");
```

## Integration Points

### 1. Recommendation Engine

Before showing recommendations, apply decay:

```typescript
// lib/recommendations/suggestion-engine.ts
async function getSuggestions(userId: string) {
  // Get user's merchants
  let merchants = await db
    .select()
    .from(merchants)
    .where(eq(merchants.userId, userId));

  // Apply usage decay
  merchants = merchants.map(m => ({
    ...m,
    score: applyUsageDecay(
      m.usageCount,
      m.lastUsedAt,
      getDecayConfigByType("merchants")
    )
  }));

  // Sort by decayed score
  return merchants.sort((a, b) => b.score - a.score);
}
```

### 2. Dropdown Sorting

Use decayed scores for dropdown ordering:

```typescript
// components/merchant-dropdown.tsx
async function getMerchantSuggestions() {
  const merchants = await fetch("/api/merchants?sorted=true")
    .then(r => r.json());

  // Merchants already sorted by decayed usage
  return merchants;
}
```

### 3. Dashboard Widgets

Show top items based on decayed scores:

```typescript
// components/dashboard/top-merchants.tsx
async function TopMerchants() {
  // Get merchants with applied decay
  const merchants = await fetch("/api/suggestions/merchants")
    .then(r => r.json());

  return merchants.slice(0, 5);
}
```

## Scheduling

### Recommended Schedule

Run decay at different frequencies for different types:

```bash
# Daily at 2 AM UTC - Fast-decay items (merchants)
0 2 * * * curl -X POST https://yourdomain.com/api/cron/usage-decay?type=merchants \
  -H "Authorization: Bearer $CRON_SECRET"

# Weekly at 3 AM UTC Monday - Medium-decay items (categories, tags)
0 3 * * 1 curl -X POST https://yourdomain.com/api/cron/usage-decay \
  -H "Authorization: Bearer $CRON_SECRET"

# Monthly at 4 AM UTC 1st - All types (comprehensive)
0 4 1 * * curl -X POST https://yourdomain.com/api/cron/usage-decay \
  -H "Authorization: Bearer $CRON_SECRET"
```

### One-Time Setup

```bash
# Set CRON_SECRET in .env
CRON_SECRET=your-secure-secret

# Test locally
curl -X POST http://localhost:3000/api/cron/usage-decay \
  -H "Authorization: Bearer your-secure-secret"

# Schedule via cron-job.org or similar service
```

## Performance Impact

### Computation Cost

```
Per Item: ~0.1-1ms
Per Batch: 10-100ms depending on batch size
Database Update: 100-1000ms depending on scale
```

Example: Decaying 10,000 items takes ~5-10 seconds

### Database Impact

- **Read:** Minimal (just selecting items with usage data)
- **Write:** Updates usage scores (can be batched)
- **Index:** Uses existing lastUsedAt indexes
- **Downtime:** None (non-blocking)

### Optimization Tips

1. **Batch Updates:** Update 1000 items at a time
2. **Off-Peak Schedule:** Run during low-traffic hours
3. **Selective Decay:** Run each type separately
4. **Incremental:** Don't decay all items every day

## Examples

### Example 1: Merchant Decay

User hasn't used "Starbucks" in 30 days. Score was 25.

```
Configuration:
- Strategy: Recency-Bonus
- Half-Life: 30 days
- Decay Rate: 85%
- Recency Bonus: 2× (within 7 days)
- Min Score: 0.1

Calculation:
- Days Old: 30
- Decay Factor: 85% ^ (30/30) = 85%
- Recency Bonus: 1.0× (outside 7-day window)
- New Score: 25 × 0.85 × 1.0 = 21.25

Result: Score reduced from 25 to 21.25 (15% decay)
```

### Example 2: Category Decay

User hasn't used "Groceries" category in 45 days. Score was 150.

```
Configuration:
- Strategy: Time-Weighted
- Half-Life: 60 days
- Decay Rate: 92%
- Recency Bonus: 1.3× (within 14 days)
- Min Score: 0.5

Calculation:
- Days Old: 45
- Decay Factor: 1 - (45/60) = 0.25
- Recency Bonus: 1.0× (outside 14-day window)
- New Score: 150 × 0.25 × 1.0 = 37.5

Result: Score reduced from 150 to 37.5 (75% decay)
```

### Example 3: Account Decay

User's savings account hasn't been used in 120 days. Score was 200.

```
Configuration:
- Strategy: Exponential
- Half-Life: 90 days
- Decay Rate: 95%
- Recency Bonus: 1.5× (within 7 days)
- Min Score: 1

Calculation:
- Days Old: 120
- Decay Factor: 95% ^ (120/90) = 92.2%
- Recency Bonus: 1.0× (outside 7-day window)
- New Score: 200 × 0.922 × 1.0 = 184.4

Result: Score reduced from 200 to 184.4 (7.8% decay - very slow)
```

## Monitoring & Analysis

### View Decay Report

```bash
# Get decay report for merchants
curl https://yourdomain.com/api/cron/usage-decay/report?type=merchants

# Response includes:
# - Configuration used
# - Impact summary (items affected, total change)
# - Top decayed items table
# - Markdown report for analysis
```

### Key Metrics

Monitor these metrics after decay is applied:

1. **Items Affected:** How many items were decayed
2. **Total Score Change:** Sum of all score reductions
3. **Average Decay %:** Mean decay percentage
4. **Max/Min Decay %:** Range of decay

## Advanced Customization

### Custom Decay Configuration

```typescript
import { createCustomDecayConfig } from "@/lib/analytics/usage-decay";

// Create custom configuration
const config = createCustomDecayConfig("exponential", {
  halfLifeDays: 45,        // Custom half-life
  decayRate: 0.9,          // Custom decay rate
  minScore: 0.2,           // Custom minimum
});

// Use in decay function
const newScore = applyUsageDecay(100, lastUsed, config);
```

### Conditional Decay

```typescript
// Apply different decay based on user settings
if (userPreferences.preserveHistory) {
  // Slower decay for users who want to preserve patterns
  config.halfLifeDays = 180;
} else {
  // Faster decay for users who want fresh recommendations
  config.halfLifeDays = 30;
}
```

## Troubleshooting

### All Scores Reach Minimum

**Cause:** Min score too high, decay too aggressive

**Fix:** Reduce decay rate or increase half-life

```typescript
const config = createCustomDecayConfig("exponential", {
  decayRate: 0.96,     // Increase from 0.9
  halfLifeDays: 90,    // Increase from 60
  minScore: 0.1,       // Decrease from 1
});
```

### Recommendations Stale

**Cause:** Decay too slow, old patterns dominating

**Fix:** Use recency bonus strategy or reduce half-life

```typescript
const config = createCustomDecayConfig("recency-bonus", {
  halfLifeDays: 30,
  recencyBonusMultiplier: 2,
});
```

### Frequent Items Disappear Too Fast

**Cause:** Min score too low for frequently-used items

**Fix:** Increase min score or use exponential decay

```typescript
const config = createCustomDecayConfig("exponential", {
  minScore: 1,  // Keep at least score of 1
});
```

## References

- [Exponential Decay](https://en.wikipedia.org/wiki/Exponential_decay)
- [Time-Weighted Metrics](https://en.wikipedia.org/wiki/Time_weighting)
- [Recommendation Systems](https://en.wikipedia.org/wiki/Recommender_system)
- [Collaborative Filtering](https://en.wikipedia.org/wiki/Collaborative_filtering)

## Summary

The usage decay algorithm ensures that recommendations evolve with user behavior. By gradually reducing the weight of older usage data, the system stays responsive to changes while maintaining patterns that persist. Choose the right strategy and configuration for each data type, and let the algorithm keep suggestions fresh and relevant.
