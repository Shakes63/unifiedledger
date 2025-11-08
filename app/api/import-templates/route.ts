import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { importTemplates } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/import-templates
 * Get all import templates for the current user
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await db
      .select()
      .from(importTemplates)
      .where(eq(importTemplates.userId, userId));

    return Response.json(templates);
  } catch (error) {
    console.error('Error fetching import templates:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/import-templates
 * Create a new import template
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const {
      name,
      description,
      columnMappings,
      dateFormat,
      delimiter = ',',
      hasHeaderRow = true,
      skipRows = 0,
      defaultAccountId,
      householdId,
    } = body;

    // Validate required fields
    if (!name || !columnMappings || !dateFormat) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const templateId = nanoid();
    const now = new Date().toISOString();

    const template = {
      id: templateId,
      userId,
      householdId: householdId || null,
      name,
      description: description || null,
      columnMappings: JSON.stringify(columnMappings),
      dateFormat,
      delimiter,
      hasHeaderRow,
      skipRows,
      defaultAccountId: defaultAccountId || null,
      isFavorite: false,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(importTemplates).values(template);

    return Response.json(
      {
        ...template,
        columnMappings: JSON.parse(template.columnMappings),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating import template:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
