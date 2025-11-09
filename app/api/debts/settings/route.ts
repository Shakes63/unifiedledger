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
        paymentFrequency: 'monthly',
      });
    }

    return Response.json({
      extraMonthlyPayment: settings[0].extraMonthlyPayment || 0,
      preferredMethod: settings[0].preferredMethod || 'avalanche',
      paymentFrequency: settings[0].paymentFrequency || 'monthly',
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
    const { extraMonthlyPayment, preferredMethod, paymentFrequency } = body;

    // Validate payment frequency
    if (paymentFrequency && !['monthly', 'biweekly'].includes(paymentFrequency)) {
      return Response.json({ error: 'Invalid payment frequency. Must be "monthly" or "biweekly"' }, { status: 400 });
    }

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
        paymentFrequency: paymentFrequency || 'monthly',
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
          paymentFrequency: paymentFrequency || existingSettings[0].paymentFrequency,
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
