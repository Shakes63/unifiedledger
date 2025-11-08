# Cron Job Setup for Notifications

This guide explains how to set up automated notifications via cron jobs.

## Overview

The application has multiple cron-compatible endpoints that check various conditions and create notifications:

| Endpoint | Purpose | Frequency |
|----------|---------|-----------|
| `/api/notifications/bill-reminders` | Check for upcoming/overdue bills | Daily (8 AM UTC) |
| `/api/notifications/budget-warnings` | Check budget spending thresholds | Daily (9 AM UTC) |
| `/api/notifications/low-balance-alerts` | Check account balances | Daily (8 AM UTC) |
| `/api/notifications/savings-milestones` | Check savings goal progress | Daily (10 AM UTC) |
| `/api/notifications/debt-milestones` | Check debt payoff progress | Daily (10 AM UTC) |

All endpoints should be called via POST requests.

## Setup Options

### Option 1: Using Vercel Cron (Recommended for Vercel Deployments)

If you're deploying to Vercel, use Vercel Functions with cron triggers.

**Create `/api/cron/bill-reminders.ts`:**

```typescript
import { NextResponse } from 'next/server';
import { checkAndCreateBillReminders } from '@/lib/notifications/bill-reminders';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  // Verify the request is from Vercel
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await checkAndCreateBillReminders();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Failed to process bill reminders' },
      { status: 500 }
    );
  }
}
```

**In `vercel.json`:**

```json
{
  "crons": [
    {
      "path": "/api/cron/bill-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

**Environment Variable:**
- Set `CRON_SECRET` in Vercel dashboard (generate a random string)

### Option 2: Using cron-job.org (Free Third-Party Service)

1. Go to [cron-job.org](https://cron-job.org)
2. Sign up for a free account
3. Create a new cronjob with these settings:
   - **URL:** `https://yourdomain.com/api/notifications/bill-reminders`
   - **Schedule:** Daily at 8 AM UTC
     - Cron expression: `0 8 * * *`
   - **Authentication:** Optional (recommended for production)

### Option 3: Using EasyCron (Alternative Free Service)

1. Go to [easycron.com](https://easycron.com)
2. Sign up for a free account
3. Add a new cronjob:
   - **URL:** `https://yourdomain.com/api/notifications/bill-reminders`
   - **Frequency:** Daily at 8:00 AM

### Option 4: Using AWS EventBridge (Production)

If you're running on AWS:

1. Create a Lambda function that calls your API endpoint
2. Use EventBridge to trigger it daily
3. Example cron expression: `cron(0 8 * * ? *)`

### Option 5: Using Coolify Cron (If Deploying with Coolify)

Since this app is configured for Coolify, you can set up crons directly:

**In deployment configuration:**

```yaml
crons:
  - schedule: '0 8 * * *'
    command: 'curl https://yourdomain.com/api/notifications/bill-reminders'
```

## Testing

Test the endpoint manually to ensure it works:

```bash
# Using curl
curl https://yourdomain.com/api/notifications/bill-reminders

# Using fetch in browser console
fetch('/api/notifications/bill-reminders').then(r => r.json()).then(console.log)
```

Expected response:
```json
{
  "success": true,
  "notificationsCreated": 5,
  "checkedInstances": 25,
  "timestamp": "2025-01-15T08:00:00.000Z"
}
```

## Notification Behavior

The cron job will:

1. **Identify upcoming bills** - Find all pending bill instances
2. **Check for reminders** - Determine which ones need notifications:
   - Bills overdue (negative days)
   - Bills due today (0 days)
   - Bills due tomorrow (1 day)
   - Bills due in 3 days (configurable per user)

3. **Create notifications** - Generate notifications based on user preferences:
   - Skip if user has disabled bill reminders
   - Respect quiet hours (if configured)
   - Create appropriate notification types:
     - `bill_due` - for upcoming bills
     - `bill_overdue` - for late bills

4. **Push notifications** - Optionally send push notifications to devices:
   - Only if user has enabled push notifications
   - Use configured notification service

## Frequency Recommendations

- **Daily (once)** - Recommended for production
  - Cron: `0 8 * * *` (8 AM UTC)
  - Sufficient for typical user needs

- **Twice daily** - For users with time-sensitive requirements
  - Morning: `0 8 * * *` (8 AM UTC)
  - Evening: `0 18 * * *` (6 PM UTC)

- **Multiple times daily** - Only if needed for critical bills
  - Every 6 hours: `0 */6 * * *`
  - Higher server load, minimal additional benefit

## Monitoring

### Check Recent Runs

Navigate to `/api/notifications` to see recent notifications created

### Logs

Most cron services provide execution logs. Check:
- Vercel Dashboard → Functions → Logs
- cron-job.org → Execution logs
- EasyCron → Job history
- Coolify → Container logs

### Alerting (Optional)

Set up monitoring to alert if cron job fails:

```javascript
// In your monitoring setup
if (!result.success) {
  // Send alert via email, Slack, etc.
  sendAlert('Bill reminder cron job failed');
}
```

## Troubleshooting

### Cron job not running
- Check if the endpoint is accessible from the internet
- Verify authentication headers if required
- Check service logs for errors

### Notifications not being created
- Verify bills exist in the database
- Check that notification preferences enable bill reminders
- Look for quiet hours blocking notifications

### Too many notifications
- Increase the `billReminderDaysBefore` value
- Add quiet hours to reduce notification frequency
- Consider running cron job less frequently

## User Control

Users can manage their preferences at:
- Settings → Notification Preferences
- Toggle bill reminders on/off
- Adjust days before due date for reminders
- Set quiet hours to avoid notifications during sleep

## Security Considerations

1. **Rate Limiting** - The endpoint has basic auth checks
   - In production, add rate limiting
   - Use API keys for cron service authentication

2. **CSRF Protection** - POST endpoint would need CSRF token
   - Current implementation uses GET (less secure for production)
   - Consider switching to POST with token validation

3. **Authorization** - Current endpoint is public
   - For production, implement cron secret validation
   - See "Option 1: Vercel Cron" for example

## Budget Warnings Endpoint

The `/api/notifications/budget-warnings` endpoint checks all budget categories and creates notifications when spending exceeds configured thresholds.

### Configuration

Users can configure via Notification Preferences:
- **Budget Warning Enabled** - Toggle budget warnings on/off
- **Budget Warning Threshold** - Percentage (default: 80%)
- **Budget Exceeded Alert** - Create notification at 100% (default: enabled)

### How It Works

1. Checks all active budget categories for each user with warnings enabled
2. Calculates current month's spending for each category
3. Creates `budget_warning` notification if spending ≥ threshold percentage
4. Creates `budget_exceeded` notification if spending ≥ 100% (and enabled)
5. Prevents duplicate notifications on the same day

### Recommended Schedule

```
Daily at 9 AM UTC: 0 9 * * *
```

## Low Balance Alerts Endpoint

The `/api/notifications/low-balance-alerts` endpoint checks all accounts and creates notifications when balance falls below configured threshold.

### Configuration

Users can configure via Notification Preferences:
- **Low Balance Alert Enabled** - Toggle alerts on/off
- **Low Balance Threshold** - Dollar amount (default: $100)

### How It Works

1. Checks all active accounts for each user with alerts enabled
2. Compares current balance against configured threshold
3. Creates `low_balance` notification if balance < threshold
4. Sets priority based on balance level:
   - `urgent` - Balance ≤ $0
   - `high` - Balance < 25% of threshold
   - `normal` - Balance < threshold
5. Prevents duplicate notifications on the same day

### Recommended Schedule

```
Daily at 8 AM UTC: 0 8 * * *
```

## Example Vercel Configuration with Multiple Crons

If using Vercel, configure all notification crons in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/bill-reminders",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/low-balance-alerts",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/budget-warnings",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/savings-milestones",
      "schedule": "0 10 * * *"
    },
    {
      "path": "/api/cron/debt-milestones",
      "schedule": "0 10 * * *"
    }
  ]
}
```

## Next Steps

1. Choose your cron service
2. Set up scheduled calls to all notification endpoints:
   - `/api/notifications/bill-reminders`
   - `/api/notifications/budget-warnings`
   - `/api/notifications/low-balance-alerts`
   - `/api/notifications/savings-milestones` (if using goals)
   - `/api/notifications/debt-milestones` (if using debt tracking)
3. Test each endpoint manually
4. Monitor for 24-48 hours to ensure they're working
5. Adjust schedules if needed based on user timezone

For more information on the notification system, see [NOTIFICATIONS.md](./NOTIFICATIONS.md)
