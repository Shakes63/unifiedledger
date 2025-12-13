/**
 * API Route: POST/GET /api/cron/maintenance
 *
 * Endpoint for database maintenance operations.
 * Includes statistics collection, index optimization, and health checks.
 *
 * Security: Requires CRON_SECRET environment variable for authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Verify cron secret for security
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return false;
  }

  const token = authHeader.replace("Bearer ", "");
  return token === cronSecret;
}

/**
 * POST: Run maintenance operations
 */
export async function POST(request: NextRequest) {
  // Verify authentication
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized - Invalid or missing CRON_SECRET" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const operation = searchParams.get("operation") || "all";

    const results: {
      timestamp: number;
      operations: Array<
        | { name: string; status: 'success'; message: string }
        | { name: string; status: 'success'; stats: Record<string, number> }
        | { name: string; status: 'error'; error: string }
      >;
    } = {
      timestamp: Date.now(),
      operations: [],
    };

    // Analyze database statistics
    if (operation === "all" || operation === "analyze") {
      try {
        await db.run(sql`ANALYZE`);
        results.operations.push({
          name: "analyze",
          status: "success",
          message: "Database statistics updated",
        });
      } catch (error) {
        results.operations.push({
          name: "analyze",
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Reindex key tables
    if (operation === "all" || operation === "reindex") {
      try {
        // Reindex main tables
        await db.run(
          sql`REINDEX idx_transactions_user_date`
        );
        await db.run(
          sql`REINDEX idx_transactions_user_category`
        );
        await db.run(
          sql`REINDEX idx_accounts_user`
        );

        results.operations.push({
          name: "reindex",
          status: "success",
          message: "Database indexes reindexed",
        });
      } catch (error) {
        results.operations.push({
          name: "reindex",
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Vacuum database
    if (operation === "all" || operation === "vacuum") {
      try {
        await db.run(sql`VACUUM`);
        results.operations.push({
          name: "vacuum",
          status: "success",
          message: "Database space optimized",
        });
      } catch (error) {
        results.operations.push({
          name: "vacuum",
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Get database statistics
    if (operation === "all" || operation === "stats") {
      try {
        const pageCount = await db.run(
          sql`PRAGMA page_count`
        );
        const pageSize = await db.run(
          sql`PRAGMA page_size`
        );
        const freePages = await db.run(
          sql`PRAGMA freelist_count`
        );

        const getPragmaNumber = (result: unknown, key: string): number => {
          if (!Array.isArray(result) || result.length === 0) return 0;
          const row = result[0];
          if (!row || typeof row !== 'object') return 0;
          const value = (row as Record<string, unknown>)[key];
          return typeof value === 'number' ? value : 0;
        };

        const stats = {
          pageCount: getPragmaNumber(pageCount, 'page_count'),
          pageSize: getPragmaNumber(pageSize, 'page_size'),
          freePages: getPragmaNumber(freePages, 'freelist_count'),
          estimatedSize: getPragmaNumber(pageCount, 'page_count') * getPragmaNumber(pageSize, 'page_size'),
        };

        results.operations.push({
          name: "stats",
          status: "success",
          stats,
        });
      } catch (error) {
        results.operations.push({
          name: "stats",
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error("[Maintenance] Error:", error);
    return NextResponse.json(
      {
        error: "Maintenance failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Get maintenance configuration and status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "config") {
      const config = {
        operations: [
          {
            name: "analyze",
            description: "Update database optimizer statistics",
            frequency: "weekly",
            impact: "None (read-only)",
          },
          {
            name: "reindex",
            description: "Rebuild database indexes",
            frequency: "monthly",
            impact: "Brief table locks during reindex",
          },
          {
            name: "vacuum",
            description: "Reclaim unused database space",
            frequency: "monthly",
            impact: "Temporary space usage increase",
          },
          {
            name: "stats",
            description: "Get database statistics",
            frequency: "daily",
            impact: "None (read-only)",
          },
        ],
        scheduling: {
          recommended: {
            daily: ["stats"],
            weekly: ["analyze"],
            monthly: ["reindex", "vacuum"],
          },
        },
      };

      return NextResponse.json(config, { status: 200 });
    }

    return NextResponse.json(
      { error: "Invalid action - use ?action=config" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Maintenance] Error:", error);
    return NextResponse.json(
      {
        error: "Request failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
