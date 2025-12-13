/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '@/app/api/calendar-sync/projects/route';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/calendar/ticktick-calendar', () => ({
  listTickTickProjects: vi.fn(),
  createTickTickProject: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth-helpers';
import { listTickTickProjects, createTickTickProject } from '@/lib/calendar/ticktick-calendar';
import { db } from '@/lib/db';

function createGetRequest(url: string): Request {
  return { url } as unknown as Request;
}

function createPostRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

function mockSelectLimit(rows: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function mockUpdate() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

describe('GET/POST /api/calendar-sync/projects (TickTick)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (requireAuth as any).mockResolvedValue({ userId: 'user-1' });
    (db.update as any).mockReturnValue(mockUpdate());
    (listTickTickProjects as any).mockResolvedValue([]);
    (createTickTickProject as any).mockResolvedValue({ id: 'proj-new', name: 'Unified Ledger' });
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = null;
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 when unauthorized', async () => {
      (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
      const res = await GET(createGetRequest('http://localhost/api/calendar-sync/projects?connectionId=conn-1'));
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 when connectionId is missing', async () => {
      const res = await GET(createGetRequest('http://localhost/api/calendar-sync/projects'));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe('connectionId is required');
    });

    it('returns 404 when connection not found (ownership/provider check)', async () => {
      (db.select as any).mockReturnValueOnce(mockSelectLimit([]));
      const res = await GET(createGetRequest('http://localhost/api/calendar-sync/projects?connectionId=conn-1'));
      const data = await res.json();
      expect(res.status).toBe(404);
      expect(data.error).toBe('Connection not found');
    });

    it('returns projects and selectedProjectId when connection exists', async () => {
      (db.select as any).mockReturnValueOnce(mockSelectLimit([{ id: 'conn-1', calendarId: 'proj-2' }]));
      const projects = [{ id: 'proj-1', name: 'A' }, { id: 'proj-2', name: 'B' }];
      (listTickTickProjects as any).mockResolvedValue(projects);

      const res = await GET(createGetRequest('http://localhost/api/calendar-sync/projects?connectionId=conn-1'));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toEqual({ projects, selectedProjectId: 'proj-2' });
    });
  });

  describe('POST', () => {
    it('returns 401 when unauthorized', async () => {
      (requireAuth as any).mockRejectedValue(new Error('Unauthorized'));
      const res = await POST(createPostRequest({ connectionId: 'conn-1', projectId: 'proj-1' }));
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 when connectionId is missing', async () => {
      const res = await POST(createPostRequest({ projectId: 'proj-1' }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe('connectionId is required');
    });

    it('returns 400 when neither projectId nor createNew is provided', async () => {
      const res = await POST(createPostRequest({ connectionId: 'conn-1' }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe('projectId or createNew is required');
    });

    it('returns 404 when connection not found', async () => {
      (db.select as any).mockReturnValueOnce(mockSelectLimit([]));
      const res = await POST(createPostRequest({ connectionId: 'conn-1', projectId: 'proj-1' }));
      const data = await res.json();
      expect(res.status).toBe(404);
      expect(data.error).toBe('Connection not found');
    });

    it('returns 404 when projectId not found in provider list', async () => {
      (db.select as any).mockReturnValueOnce(mockSelectLimit([{ id: 'conn-1' }]));
      (listTickTickProjects as any).mockResolvedValue([{ id: 'proj-1', name: 'A' }]);

      const res = await POST(createPostRequest({ connectionId: 'conn-1', projectId: 'missing' }));
      const data = await res.json();
      expect(res.status).toBe(404);
      expect(data.error).toBe('Project not found');
    });

    it('selects existing project and updates connection', async () => {
      (db.select as any).mockReturnValueOnce(mockSelectLimit([{ id: 'conn-1' }]));
      (listTickTickProjects as any).mockResolvedValue([{ id: 'proj-1', name: 'A' }]);

      const res = await POST(createPostRequest({ connectionId: 'conn-1', projectId: 'proj-1' }));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toEqual({ success: true, projectId: 'proj-1', projectName: 'A' });
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('creates new project when createNew=true and updates connection', async () => {
      (db.select as any).mockReturnValueOnce(mockSelectLimit([{ id: 'conn-1' }]));
      (createTickTickProject as any).mockResolvedValue({ id: 'proj-new', name: 'Unified Ledger' });

      const res = await POST(createPostRequest({ connectionId: 'conn-1', createNew: true, projectName: 'Unified Ledger' }));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toEqual({ success: true, projectId: 'proj-new', projectName: 'Unified Ledger' });
      expect(createTickTickProject).toHaveBeenCalledTimes(1);
      expect(db.update).toHaveBeenCalledTimes(1);
    });
  });
});


