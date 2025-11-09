import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { debtSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await db
      .select()
      .from(debtSettings)
      .where(eq(debtSettings.userId, userId))
      .limit(1);

    if (settings.length === 0) {
      // Return default settings if none exist
      return Response.json({
        extraMonthlyPayment: 0,
        preferredMethod: 'avalanche',
      });
    }

    return Response.json({
      extraMonthlyPayment: settings[0].extraMonthlyPayment || 0,
      preferredMethod: settings[0].preferredMethod || 'avalanche',
    });
  } catch (error) {
    console.error('Error fetching debt settings:', error);
    return Response.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { extraMonthlyPayment, preferredMethod } = body;

    // Check if settings exist
    const existingSettings = await db
      .select()
      .from(debtSettings)
      .where(eq(debtSettings.userId, userId))
      .limit(1);

    if (existingSettings.length === 0) {
      // Create new settings
      await db.insert(debtSettings).values({
        id: nanoid(),
        userId,
        extraMonthlyPayment: extraMonthlyPayment || 0,
        preferredMethod: preferredMethod || 'avalanche',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Update existing settings
      await db
        .update(debtSettings)
        .set({
          extraMonthlyPayment: extraMonthlyPayment !== undefined ? extraMonthlyPayment : existingSettings[0].extraMonthlyPayment,
          preferredMethod: preferredMethod || existingSettings[0].preferredMethod,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(debtSettings.userId, userId));
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error saving debt settings:', error);
    return Response.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
