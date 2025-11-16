import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/owner-helpers';
import { db } from '@/lib/db';
import { user as betterAuthUser } from '@/auth-schema';
import { households } from '@/lib/db/schema';
import { readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * GET /api/admin/system-info
 * Get system information (owner only)
 * Returns application version, user count, household count, and database size
 */
export async function GET() {
  try {
    // Verify owner access
    await requireOwner();

    // Get application version from package.json
    let version = '0.0.0';
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      version = packageJson.version || '0.0.0';
    } catch (error) {
      console.warn('[Admin API] Could not read package.json:', error);
      // Use default version
    }

    // Get total users count
    const users = await db
      .select({ id: betterAuthUser.id })
      .from(betterAuthUser);
    const totalUsers = users.length;

    // Get total households count
    const householdList = await db
      .select({ id: households.id })
      .from(households);
    const totalHouseholds = householdList.length;

    // Get database file size (if accessible)
    let databaseSize: number | null = null;
    let databaseSizeFormatted: string = 'Unknown';
    
    try {
      // Try to get database file size
      // SQLite database is typically at project root or in drizzle folder
      const possiblePaths = [
        join(process.cwd(), 'sqlite.db'),
        join(process.cwd(), 'database.db'),
        join(process.cwd(), 'app.db'),
        join(process.cwd(), 'local.db'),
      ];

      for (const dbPath of possiblePaths) {
        try {
          const stats = statSync(dbPath);
          databaseSize = stats.size;
          // Format size (bytes to MB/GB)
          if (databaseSize < 1024 * 1024) {
            databaseSizeFormatted = `${(databaseSize / 1024).toFixed(2)} KB`;
          } else if (databaseSize < 1024 * 1024 * 1024) {
            databaseSizeFormatted = `${(databaseSize / (1024 * 1024)).toFixed(2)} MB`;
          } else {
            databaseSizeFormatted = `${(databaseSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;
          }
          break;
        } catch {
          // File doesn't exist at this path, try next
          continue;
        }
      }
    } catch (error) {
      console.warn('[Admin API] Could not determine database size:', error);
      // Continue without database size
    }

    return NextResponse.json({
      version,
      totalUsers,
      totalHouseholds,
      databaseSize,
      databaseSizeFormatted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden: Owner access required' },
        { status: 403 }
      );
    }
    console.error('[Admin API] Error fetching system info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

