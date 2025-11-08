import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Health Check Endpoint
 *
 * Used by Docker/Coolify for container health checks.
 * Verifies both application and database connectivity.
 *
 * GET /api/health
 *
 * Returns:
 * - 200 OK: Application and database are healthy
 * - 503 Service Unavailable: Application or database issues
 */
export async function GET(request: NextRequest) {
  try {
    // Check database connectivity by running a simple query
    const connection = await db.select().from(users).limit(1).execute();

    // Return healthy status
    return NextResponse.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Health check failed:", error);

    // Return unhealthy status
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
      },
      { status: 503 }
    );
  }
}

/**
 * Liveness probe - quick check that application is running
 * Can be used instead of full health check for faster responses
 */
export async function HEAD(request: NextRequest) {
  try {
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
