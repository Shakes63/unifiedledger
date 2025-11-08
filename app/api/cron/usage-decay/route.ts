/**
 * API Route: POST /api/cron/usage-decay
 *
 * Applies usage decay algorithm to freshen up recommendations.
 * Decays old usage scores so recent activity is weighted more heavily.
 *
 * Security: Requires CRON_SECRET environment variable for authentication
 *
 * Usage:
 * - POST /api/cron/usage-decay - Apply decay to all types
 * - POST /api/cron/usage-decay?type=accounts - Apply decay to specific type
 * - GET /api/cron/usage-decay/report?type=merchants - Get decay report
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getDecayConfigByType,
  applyBatchDecay,
  calculateDecayImpact,
  generateDecayReport,
  type UsageDecayConfig,
} from "@/lib/analytics/usage-decay";

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
 * Apply decay to accounts usage
 */
async function decayAccountsUsage(): Promise<{
  type: string;
  itemsProcessed: number;
  itemsAffected: number;
  totalScoreChange: number;
  averageDecay: number;
}> {
  try {
    // Get all accounts with usage data
    // Note: This is a placeholder - actual implementation depends on your schema
    const items = [
      // Mock data for demonstration
      {
        id: "account1",
        name: "Checking",
        usageCount: 100,
        lastUsedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      },
    ];

    const config = getDecayConfigByType("accounts");
    const results = applyBatchDecay(items, config);
    const impact = calculateDecayImpact(items, config);

    // TODO: Update database with decayed scores
    // await db.update(accounts).set({ usageCount: decayedScore })

    return {
      type: "accounts",
      itemsProcessed: items.length,
      itemsAffected: impact.itemsAffected,
      totalScoreChange: impact.totalScoreChange,
      averageDecay: impact.averageDecayPercentage,
    };
  } catch (error) {
    console.error("[UsageDecay] Error processing accounts:", error);
    throw error;
  }
}

/**
 * Apply decay to categories usage
 */
async function decayCategoriesUsage(): Promise<{
  type: string;
  itemsProcessed: number;
  itemsAffected: number;
  totalScoreChange: number;
  averageDecay: number;
}> {
  try {
    // Get all categories with usage data
    const items = [
      // Mock data for demonstration
      {
        id: "cat1",
        name: "Groceries",
        usageCount: 50,
        lastUsedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      },
    ];

    const config = getDecayConfigByType("categories");
    const results = applyBatchDecay(items, config);
    const impact = calculateDecayImpact(items, config);

    // TODO: Update database with decayed scores

    return {
      type: "categories",
      itemsProcessed: items.length,
      itemsAffected: impact.itemsAffected,
      totalScoreChange: impact.totalScoreChange,
      averageDecay: impact.averageDecayPercentage,
    };
  } catch (error) {
    console.error("[UsageDecay] Error processing categories:", error);
    throw error;
  }
}

/**
 * Apply decay to merchants usage
 */
async function decayMerchantsUsage(): Promise<{
  type: string;
  itemsProcessed: number;
  itemsAffected: number;
  totalScoreChange: number;
  averageDecay: number;
}> {
  try {
    // Get all merchants with usage data
    const items = [
      // Mock data for demonstration
      {
        id: "merch1",
        name: "Amazon",
        usageCount: 25,
        lastUsedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      },
    ];

    const config = getDecayConfigByType("merchants");
    const results = applyBatchDecay(items, config);
    const impact = calculateDecayImpact(items, config);

    // TODO: Update database with decayed scores

    return {
      type: "merchants",
      itemsProcessed: items.length,
      itemsAffected: impact.itemsAffected,
      totalScoreChange: impact.totalScoreChange,
      averageDecay: impact.averageDecayPercentage,
    };
  } catch (error) {
    console.error("[UsageDecay] Error processing merchants:", error);
    throw error;
  }
}

/**
 * Apply decay to tags usage
 */
async function decayTagsUsage(): Promise<{
  type: string;
  itemsProcessed: number;
  itemsAffected: number;
  totalScoreChange: number;
  averageDecay: number;
}> {
  try {
    // Get all tags with usage data
    const items = [
      // Mock data for demonstration
      {
        id: "tag1",
        name: "Work",
        usageCount: 30,
        lastUsedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
      },
    ];

    const config = getDecayConfigByType("tags");
    const results = applyBatchDecay(items, config);
    const impact = calculateDecayImpact(items, config);

    // TODO: Update database with decayed scores

    return {
      type: "tags",
      itemsProcessed: items.length,
      itemsAffected: impact.itemsAffected,
      totalScoreChange: impact.totalScoreChange,
      averageDecay: impact.averageDecayPercentage,
    };
  } catch (error) {
    console.error("[UsageDecay] Error processing tags:", error);
    throw error;
  }
}

/**
 * POST: Apply usage decay to freshen recommendations
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
    const type = searchParams.get("type");

    const results: Array<{
      type: string;
      itemsProcessed: number;
      itemsAffected: number;
      totalScoreChange: number;
      averageDecay: number;
    }> = [];

    console.log("[UsageDecay] Starting decay application");

    // Apply decay to requested types
    if (!type || type === "accounts") {
      const result = await decayAccountsUsage();
      results.push(result);
    }

    if (!type || type === "categories") {
      const result = await decayCategoriesUsage();
      results.push(result);
    }

    if (!type || type === "merchants") {
      const result = await decayMerchantsUsage();
      results.push(result);
    }

    if (!type || type === "tags") {
      const result = await decayTagsUsage();
      results.push(result);
    }

    const totalItems = results.reduce((sum, r) => sum + r.itemsProcessed, 0);
    const totalAffected = results.reduce((sum, r) => sum + r.itemsAffected, 0);
    const totalChange = results.reduce((sum, r) => sum + r.totalScoreChange, 0);

    console.log(
      `[UsageDecay] Completed - Processed ${totalItems} items, affected ${totalAffected}, total change: -${totalChange.toFixed(2)}`
    );

    return NextResponse.json(
      {
        timestamp: Date.now(),
        totalItemsProcessed: totalItems,
        totalItemsAffected: totalAffected,
        totalScoreChange: Math.round(totalChange * 100) / 100,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[UsageDecay] Error:", error);
    return NextResponse.json(
      {
        error: "Decay application failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Get decay report for analysis
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const type = searchParams.get("type");

    if (action === "report" && type) {
      // Get decay configuration
      const config = getDecayConfigByType(
        type as "accounts" | "categories" | "merchants" | "tags" | "transfers"
      );

      // Generate mock report for demonstration
      const mockItems = [
        {
          id: "item1",
          name: "Item 1",
          usageCount: 100,
          lastUsedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        {
          id: "item2",
          name: "Item 2",
          usageCount: 50,
          lastUsedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        {
          id: "item3",
          name: "Item 3",
          usageCount: 25,
          lastUsedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        },
      ];

      const report = generateDecayReport(mockItems, config, type);

      return NextResponse.json({
        type,
        config,
        report,
        markdown: report,
      });
    }

    return NextResponse.json(
      {
        error: "Invalid request",
        usage: "?action=report&type=merchants|accounts|categories|tags",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("[UsageDecay] Error:", error);
    return NextResponse.json(
      {
        error: "Report generation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
