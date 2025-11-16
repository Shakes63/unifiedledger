import { NextResponse } from 'next/server';
import { getCurrentUserOwnerStatus } from '@/lib/auth/owner-helpers';

/**
 * GET /api/admin/check-owner
 * Check if current user is the application owner
 * Returns { isOwner: boolean }
 * Used by frontend to conditionally show admin tab
 */
export async function GET() {
  try {
    const isOwner = await getCurrentUserOwnerStatus();
    
    // If not authenticated, return false (not null)
    return NextResponse.json({
      isOwner: isOwner === true,
    });
  } catch (error) {
    console.error('[Admin API] Error checking owner status:', error);
    // Return false on error (safer than exposing admin features)
    return NextResponse.json({
      isOwner: false,
    });
  }
}

