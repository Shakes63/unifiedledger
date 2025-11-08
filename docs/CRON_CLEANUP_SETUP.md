# Cron Job Setup for Data Cleanup & Maintenance

## Overview

Unified Ledger includes automated data cleanup and database maintenance endpoints designed to run via cron jobs. These services keep your database optimized and clean by:

- Removing old search history (90+ days)
- Archiving activity logs (365+ days)
- Cleaning up import records (180+ days)
- Removing orphaned references
- Optimizing database performance
- Maintaining query execution speed

## Quick Start

### 1. Set Environment Variable

Add to your `.env.local`:

```bash
CRON_SECRET=your-secure-random-secret-here
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

### 2. Schedule Cron Jobs

Choose your cron service and add the endpoints below.

## API Endpoints

### 1. Data Cleanup Endpoint
**`POST /api/cron/cleanup`**

Removes old records according to retention policies.

#### Full Cleanup (All Operations)
```bash
curl -X POST https://yourdomain.com/api/cron/cleanup \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

#### Specific Cleanup Operation
```bash
curl -X POST https://yourdomain.com/api/cron/cleanup?operation=oldSearchHistory \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

#### Available Operations
- `oldSearchHistory` - Remove search history older than 90 days
- `oldActivityLogs` - Remove activity logs older than 365 days
- `oldImportHistory` - Remove import records older than 180 days
- `orphanedSplits` - Remove splits for deleted transactions
- `orphanedTags` - Remove tag associations for deleted items
- `orphanedCustomFieldValues` - Remove custom field values for deleted transactions
- `unusedTags` - Remove tags with zero usage
- `databaseAnalyze` - Update optimizer statistics
- `databaseVacuum` - Reclaim unused space

#### Response
```json
{
  "totalDeleted": 1234,
  "totalDuration": 2543.5,
  "stats": [
    {
      "name": "oldSearchHistory",
      "deletedRecords": 450,
      "duration": 234.2,
      "status": "success",
      "timestamp": 1699564800000
    }
  ],
  "timestamp": 1699564800000
}
```

### 2. Database Maintenance Endpoint
**`POST /api/cron/maintenance`**

Optimizes and maintains database health.

#### Full Maintenance
```bash
curl -X POST https://yourdomain.com/api/cron/maintenance \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

#### Specific Maintenance Operation
```bash
curl -X POST https://yourdomain.com/api/cron/maintenance?operation=analyze \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

#### Available Operations
- `analyze` - Update database statistics (safe, read-only)
- `reindex` - Rebuild database indexes
- `vacuum` - Reclaim unused space
- `stats` - Get database statistics
- `all` - Run all maintenance operations

#### Response
```json
{
  "timestamp": 1699564800000,
  "operations": [
    {
      "name": "analyze",
      "status": "success",
      "message": "Database statistics updated"
    },
    {
      "name": "stats",
      "status": "success",
      "stats": {
        "pageCount": 1000,
        "pageSize": 4096,
        "freePages": 50,
        "estimatedSize": 4096000
      }
    }
  ]
}
```

### 3. Configuration Endpoints

#### Get Cleanup Configuration
```bash
curl https://yourdomain.com/api/cron/cleanup?action=config
```

#### Get Maintenance Configuration
```bash
curl https://yourdomain.com/api/cron/maintenance?action=config
```

## Retention Policies

Data is retained according to these policies:

| Data Type | Retention | Use Case |
|-----------|-----------|----------|
| Search History | 90 days | Keep recent searches, remove old |
| Import History | 180 days | Keep 6 months of import records |
| Activity Logs | 365 days | Keep 1 year of household activity |
| Performance Metrics | 30 days | Keep recent performance data |
| Sessions | 30 days | Keep recent session data |

## Recommended Cron Schedule

### Daily (9 AM UTC)
- Clean orphaned data (splits, tags, custom fields)
- Remove unused tags
- Get database statistics

```
0 9 * * * curl -X POST https://yourdomain.com/api/cron/cleanup?operation=orphanedSplits \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Weekly (Monday 10 AM UTC)
- Update database statistics
- Analyze database for optimization

```
0 10 * * 1 curl -X POST https://yourdomain.com/api/cron/maintenance?operation=analyze \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Monthly (First day at 11 AM UTC)
- Remove old search history
- Remove old import history
- Vacuum database to reclaim space
- Reindex tables

```
0 11 1 * * curl -X POST https://yourdomain.com/api/cron/cleanup?operation=oldSearchHistory \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Setup Instructions

### Option 1: Using cron-job.org (Free, Reliable)

1. Go to [cron-job.org](https://cron-job.org/)
2. Create a free account
3. Click "Create Cronjob"
4. Configure as follows:

**Daily Cleanup**
- **URL:** `https://yourdomain.com/api/cron/cleanup?operation=orphanedSplits`
- **HTTP Method:** POST
- **Headers:** `Authorization: Bearer YOUR_CRON_SECRET`
- **Schedule:** Every day at 9:00 AM
- **Notification:** Enable email on failure

**Weekly Maintenance**
- **URL:** `https://yourdomain.com/api/cron/maintenance?operation=analyze`
- **HTTP Method:** POST
- **Headers:** `Authorization: Bearer YOUR_CRON_SECRET`
- **Schedule:** Every Monday at 10:00 AM

**Monthly Deep Clean**
- **URL:** `https://yourdomain.com/api/cron/cleanup`
- **HTTP Method:** POST
- **Headers:** `Authorization: Bearer YOUR_CRON_SECRET`
- **Schedule:** 1st of month at 11:00 AM

### Option 2: Using EasyCron (Free)

1. Go to [easycron.com](https://www.easycron.com/)
2. Create account
3. Add a cron job:
   - **URL:** `https://yourdomain.com/api/cron/cleanup`
   - **HTTP Method:** POST
   - **Custom Headers:** `Authorization: Bearer YOUR_CRON_SECRET`
   - **Cron Expression:** `0 9 * * *` (daily at 9 AM UTC)

### Option 3: Using Vercel Cron Functions (If Deployed to Vercel)

Create `api/cron.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: NextRequest) {
  // Verify secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Call cleanup endpoint
    const response = await fetch('https://yourdomain.com/api/cron/cleanup', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    return NextResponse.json(await response.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

Then in `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron",
    "schedule": "0 9 * * *"
  }]
}
```

### Option 4: AWS EventBridge + Lambda

1. Create Lambda function calling your endpoint
2. Set up EventBridge rule with cron expression
3. Connect rule to Lambda

**Example Lambda:**
```python
import boto3
import json
import urllib3

http = urllib3.PoolManager()

def lambda_handler(event, context):
    url = 'https://yourdomain.com/api/cron/cleanup'
    headers = {
        'Authorization': f"Bearer {os.environ['CRON_SECRET']}",
        'Content-Type': 'application/json'
    }

    response = http.request('POST', url, headers=headers)
    return {
        'statusCode': response.status,
        'body': json.loads(response.data.decode())
    }
```

## Monitoring & Alerts

### Log Monitoring

The cleanup endpoint logs operations to console. Monitor these in your server logs:

```
[Cleanup] Starting full cleanup cycle
[Cleanup] Completed - Deleted 1234 records in 2543.2ms
```

### Email Alerts

Set up alerts in your cron service:
- **Failure notifications** - Get email if request fails
- **Timeout alerts** - Notify if cleanup takes too long
- **Status checks** - Regular health checks

### Manual Testing

Test the endpoint locally:

```bash
# Test cleanup
curl -X POST http://localhost:3000/api/cron/cleanup \
  -H "Authorization: Bearer test-secret" \
  -H "Content-Type: application/json"

# Get configuration
curl http://localhost:3000/api/cron/cleanup?action=config
```

## Performance Impact

### Expected Runtime

| Operation | Duration | Data Impact |
|-----------|----------|-------------|
| Old search history cleanup | 50-200ms | 100-500 records removed |
| Activity logs cleanup | 100-500ms | 500-2000 records removed |
| Orphaned splits cleanup | 10-50ms | 0-50 records removed |
| Database analyze | 500-2000ms | No data change |
| Database vacuum | 1000-5000ms | Disk space reclaimed |
| Full cleanup | 2-10 seconds | 1000+ records removed |

### Database Impact

- **Downtime:** No downtime (non-blocking operations)
- **Lock duration:** <100ms for most operations
- **Disk space:** Reclaimed by VACUUM operation
- **Performance:** Improved after ANALYZE (better query plans)

## Troubleshooting

### 401 Unauthorized

**Cause:** CRON_SECRET not set or incorrect

**Fix:**
```bash
# Verify CRON_SECRET is set
echo $CRON_SECRET

# Update .env.local with correct secret
CRON_SECRET=your-secret-here

# Restart server
pnpm dev
```

### Timeout Error

**Cause:** Cleanup taking too long

**Solution:**
- Increase cron service timeout
- Run specific operations instead of all
- Schedule during off-peak hours
- Reduce data retention period if needed

### No Records Deleted

**Cause:** No data matching retention policy

**Solution:**
- Check that data exists: query database directly
- Verify retention policy dates are correct
- Check timestamps are properly stored
- Run specific operation with `operation` parameter

### Database Locked

**Cause:** Another operation in progress

**Solution:**
- Increase cron interval
- Schedule cleanups at different times
- Check for long-running queries

## Security Considerations

### CRON_SECRET

- Store in environment variables (never in code)
- Use strong, randomly generated secret (32+ characters)
- Rotate periodically (recommended: quarterly)
- Different secret for staging vs production

### IP Whitelisting

Add to `.env.local` if using cron-job.org:

```
CRON_ALLOWED_IPS=1.234.56.78,1.234.56.79
```

Then in route handler:

```typescript
const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0];
if (!CRON_ALLOWED_IPS.includes(clientIp)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Audit Logging

Enable logging to track cleanup operations:

```typescript
// In data-cleanup.ts
console.log(`[Cleanup ${userId}] ${operation} deleted ${count} records`);
```

Monitor logs for unusual patterns:
- Unexpected deletion volumes
- Failed operations
- Timeout patterns

## Advanced Configuration

### Custom Retention Policies

Edit retention periods in `lib/cleanup/data-cleanup.ts`:

```typescript
export const RETENTION_POLICIES = {
  SEARCH_HISTORY: 60,      // Keep 2 months instead of 90 days
  ACTIVITY_LOG: 180,       // Keep 6 months instead of 1 year
  // ... other policies
};
```

### Batch Operations

For very large datasets, implement pagination:

```typescript
const pageSize = 1000;
let offset = 0;
let deletedTotal = 0;

while (true) {
  const result = await deleteOldRecords(offset, pageSize);
  if (result.length === 0) break;
  deletedTotal += result.length;
  offset += pageSize;
}
```

### Conditional Cleanup

Skip cleanup if system is busy:

```typescript
const cpuUsage = process.cpuUsage();
if (cpuUsage.user > 50000000) {
  // System busy, skip cleanup
  return;
}
```

## Database Optimization

### Index Maintenance

Key indexes for performance:

```sql
-- Transactions
CREATE INDEX idx_transactions_user_date ON transactions(userId, date);
CREATE INDEX idx_transactions_category ON transactions(categoryId);

-- Search optimization
CREATE INDEX idx_saved_searches_user ON savedSearchFilters(userId);

-- Activity logging
CREATE INDEX idx_activity_user_date ON householdActivityLog(userId, createdAt);
```

### Query Optimization

Check slow queries:

```sql
PRAGMA query_only = true;
EXPLAIN QUERY PLAN SELECT * FROM transactions WHERE userId = 'user123';
```

## Monitoring Checklist

- [x] Cron secret configured
- [x] Test endpoints manually
- [x] Schedule cron jobs
- [x] Configure email alerts
- [x] Monitor logs regularly
- [x] Track cleanup statistics
- [x] Verify data retention
- [x] Audit security setup
- [ ] Monthly review of deletion stats
- [ ] Quarterly rotation of CRON_SECRET

## References

- [Cron Expression Guide](https://crontab.guru/)
- [SQLite VACUUM](https://www.sqlite.org/lang_vacuum.html)
- [SQLite ANALYZE](https://www.sqlite.org/analyze.html)
- [Database Indexing](https://www.sqlite.org/indexing.html)

## Support

For issues with cron jobs:

1. Check `.env.local` has `CRON_SECRET`
2. Verify endpoint URLs are correct
3. Test locally with curl
4. Check server logs for errors
5. Verify network connectivity to cron service
