import { requireAuth } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { calendarConnections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { listTickTickProjects, createTickTickProject } from '@/lib/calendar/ticktick-calendar';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar-sync/projects
 * List TickTick projects for a connection
 * Query params: connectionId (required)
 */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return Response.json(
        { error: 'connectionId is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const connection = await db
      .select()
      .from(calendarConnections)
      .where(
        and(
          eq(calendarConnections.id, connectionId),
          eq(calendarConnections.userId, userId),
          eq(calendarConnections.provider, 'ticktick')
        )
      )
      .limit(1);

    if (!connection[0]) {
      return Response.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Get projects from TickTick
    const projects = await listTickTickProjects(connectionId);

    return Response.json({
      projects,
      selectedProjectId: connection[0].calendarId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error listing projects:', error);
    return Response.json(
      { error: 'Failed to list projects' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendar-sync/projects
 * Select a project for sync or create a new one
 * Body: { connectionId: string, projectId?: string, createNew?: boolean, projectName?: string }
 */
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();

    const body = await request.json();
    const { connectionId, projectId, createNew, projectName } = body;

    if (!connectionId) {
      return Response.json(
        { error: 'connectionId is required' },
        { status: 400 }
      );
    }

    if (!projectId && !createNew) {
      return Response.json(
        { error: 'projectId or createNew is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const connection = await db
      .select()
      .from(calendarConnections)
      .where(
        and(
          eq(calendarConnections.id, connectionId),
          eq(calendarConnections.userId, userId),
          eq(calendarConnections.provider, 'ticktick')
        )
      )
      .limit(1);

    if (!connection[0]) {
      return Response.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    let finalProjectId = projectId;
    let finalProjectName = projectName;

    // Create a new project if requested
    if (createNew) {
      const newProject = await createTickTickProject(
        connectionId,
        projectName || 'Unified Ledger'
      );
      finalProjectId = newProject.id;
      finalProjectName = newProject.name;
    } else {
      // Verify project exists by listing projects
      const projects = await listTickTickProjects(connectionId);
      const project = projects.find((p) => p.id === projectId);
      
      if (!project) {
        return Response.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
      finalProjectName = project.name;
    }

    // Update connection with selected project
    await db
      .update(calendarConnections)
      .set({
        calendarId: finalProjectId,
        calendarName: finalProjectName,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(calendarConnections.id, connectionId));

    return Response.json({
      success: true,
      projectId: finalProjectId,
      projectName: finalProjectName,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error selecting project:', error);
    return Response.json(
      { error: 'Failed to select project' },
      { status: 500 }
    );
  }
}
