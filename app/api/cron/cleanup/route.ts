/**
 * API Route: POST/GET /api/cron/cleanup
 *
 * Endpoint for triggering data cleanup operations via cron jobs.
 * Supports selective cleanup operations and detailed reporting.
 *
 * Security: Requires CRON_SECRET environment variable for authentication
 *
 * Usage:
 * - POST /api/cron/cleanup - Run all cleanups
 * - POST /api/cron/cleanup?operation=oldSearchHistory - Run specific cleanup
 * - GET /api/cron/cleanup/config - Get cleanup configuration
 */

import { NextRequest, NextResponse } from "next/server";
import {
  runAllCleanups,
  cleanOldSearchHistory,
  cleanOldActivityLogs,
  cleanOldImportHistory,
  cleanOrphanedSplits,
  cleanOrphanedTags,
  cleanOrphanedCustomFieldValues,
  cleanUnusedTags,
  vacuumDatabase,
  analyzeDatabase,
  getCleanupConfig,
} from "@/lib/cleanup/data-cleanup";

/**
 * Verify cron secret for security
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn("[Cleanup] CRON_SECRET not configured");
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
 * POST: Run cleanup operations
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
    const operation = searchParams.get("operation");

    let result;

    if (!operation) {
      // Run all cleanups
      console.log("[Cleanup] Starting full cleanup cycle");
      result = await runAllCleanups();
      console.log(
        `[Cleanup] Completed - Deleted ${result.totalDeleted} records in ${result.totalDuration.toFixed(0)}ms`
      );
    } else {
      // Run specific cleanup
      console.log(`[Cleanup] Starting operation: ${operation}`);
      let cleanupResult;

      switch (operation) {
        case "oldSearchHistory":
          cleanupResult = await cleanOldSearchHistory();
          break;
        case "oldActivityLogs":
          cleanupResult = await cleanOldActivityLogs();
          break;
        case "oldImportHistory":
          cleanupResult = await cleanOldImportHistory();
          break;
        case "orphanedSplits":
          cleanupResult = await cleanOrphanedSplits();
          break;
        case "orphanedTags":
          cleanupResult = await cleanOrphanedTags();
          break;
        case "orphanedCustomFieldValues":
          cleanupResult = await cleanOrphanedCustomFieldValues();
          break;
        case "unusedTags":
          cleanupResult = await cleanUnusedTags();
          break;
        case "databaseAnalyze":
          cleanupResult = await analyzeDatabase();
          break;
        case "databaseVacuum":
          cleanupResult = await vacuumDatabase();
          break;
        default:
          return NextResponse.json(
            { error: `Unknown operation: ${operation}` },
            { status: 400 }
          );
      }

      result = {
        totalDeleted: cleanupResult.deletedRecords,
        totalDuration: cleanupResult.duration,
        stats: [cleanupResult],
        timestamp: cleanupResult.timestamp,
      };

      console.log(
        `[Cleanup] ${operation} completed - Deleted ${cleanupResult.deletedRecords} records in ${cleanupResult.duration.toFixed(0)}ms`
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[Cleanup] Error:", error);
    return NextResponse.json(
      {
        error: "Cleanup failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve cleanup configuration
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "config") {
      const config = getCleanupConfig();
      return NextResponse.json(config, { status: 200 });
    }

    return NextResponse.json(
      { error: "Invalid action - use ?action=config" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Cleanup] Error:", error);
    return NextResponse.json(
      {
        error: "Request failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
