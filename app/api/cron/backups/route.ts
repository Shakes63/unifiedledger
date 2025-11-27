/**
 * API Route: POST/GET /api/cron/backups
 *
 * Endpoint for triggering automatic backup scheduler via cron jobs.
 * Processes all users with enabled backups and nextBackupAt <= now.
 *
 * Security: Requires CRON_SECRET environment variable for authentication
 *
 * Usage:
 * - POST /api/cron/backups - Process scheduled backups
 * - GET /api/cron/backups - Get backup scheduler configuration
 *
 * Recommended Schedule: Daily at 2 AM UTC (0 2 * * *)
 */

import { NextRequest, NextResponse } from 'next/server';
import { processScheduledBackups } from '@/lib/backups/backup-scheduler';

/**
 * Verify cron secret for security
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('[Backup Scheduler] CRON_SECRET not configured');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return false;
  }

  const token = authHeader.replace('Bearer ', '');
  return token === cronSecret;
}

/**
 * POST: Process scheduled backups
 */
export async function POST(request: NextRequest) {
  // Verify authentication
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized - Invalid or missing CRON_SECRET' },
      { status: 401 }
    );
  }

  try {
    console.log('[Backup Scheduler] Starting scheduled backup processing');

    const result = await processScheduledBackups();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: result,
    });
  } catch (error) {
    console.error('[Backup Scheduler] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process scheduled backups',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Get backup scheduler configuration
 */
export async function GET(_request: NextRequest) {
  try {
    const config = {
      endpoint: '/api/cron/backups',
      description: 'Automatic backup scheduler',
      recommendedSchedule: '0 2 * * *', // Daily at 2 AM UTC
      scheduleDescription: 'Daily at 2 AM UTC',
      authentication: 'Bearer token with CRON_SECRET',
      operations: [
        {
          name: 'processScheduledBackups',
          description: 'Process backups for all households with enabled backups and nextBackupAt <= now',
          maxHouseholdsPerRun: 100,
        },
      ],
      notes: [
        'Backups are created based on household preferences (frequency: daily/weekly/monthly)',
        'Only households with enabled=true and nextBackupAt <= now are processed',
        'Each user-household pair has independent backup settings',
        'Maximum 100 households processed per run to avoid timeout',
        'Failed backups do not update nextBackupAt (will retry next run)',
      ],
    };

    return NextResponse.json(config, { status: 200 });
  } catch (error) {
    console.error('[Backup Scheduler] Error:', error);
    return NextResponse.json(
      {
        error: 'Request failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

