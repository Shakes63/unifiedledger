import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { importTemplates } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/import-templates/[id]
 * Get a specific import template
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();

    const { id } = await params;

    const template = await db
      .select()
      .from(importTemplates)
      .where(and(eq(importTemplates.id, id), eq(importTemplates.userId, userId)))
      .limit(1);

    if (!template.length) {
      return Response.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const result = template[0];
    return Response.json({
      ...result,
      columnMappings: JSON.parse(result.columnMappings),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching import template:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/import-templates/[id]
 * Update an import template
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();

    const { id } = await params;
    const body = await request.json();

    const {
      name,
      description,
      columnMappings,
      dateFormat,
      delimiter,
      hasHeaderRow,
      skipRows,
      defaultAccountId,
      isFavorite,
    } = body;

    // Verify template belongs to user
    const existing = await db
      .select()
      .from(importTemplates)
      .where(and(eq(importTemplates.id, id), eq(importTemplates.userId, userId)))
      .limit(1);

    if (!existing.length) {
      return Response.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (columnMappings !== undefined)
      updates.columnMappings = JSON.stringify(columnMappings);
    if (dateFormat !== undefined) updates.dateFormat = dateFormat;
    if (delimiter !== undefined) updates.delimiter = delimiter;
    if (hasHeaderRow !== undefined) updates.hasHeaderRow = hasHeaderRow;
    if (skipRows !== undefined) updates.skipRows = skipRows;
    if (defaultAccountId !== undefined)
      updates.defaultAccountId = defaultAccountId;
    if (isFavorite !== undefined) updates.isFavorite = isFavorite;

    const result = await db
      .update(importTemplates)
      .set(updates)
      .where(eq(importTemplates.id, id))
      .returning();

    if (!result.length) {
      return Response.json(
        { error: 'Failed to update template' },
        { status: 500 }
      );
    }

    const updated = result[0];
    return Response.json({
      ...updated,
      columnMappings: JSON.parse(updated.columnMappings),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating import template:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/import-templates/[id]
 * Delete an import template
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();

    const { id } = await params;

    // Verify template belongs to user
    const existing = await db
      .select()
      .from(importTemplates)
      .where(and(eq(importTemplates.id, id), eq(importTemplates.userId, userId)))
      .limit(1);

    if (!existing.length) {
      return Response.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    await db.delete(importTemplates).where(eq(importTemplates.id, id));

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting import template:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
