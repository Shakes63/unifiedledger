/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET as GET_CATEGORIES, POST as POST_CATEGORIES } from '@/app/api/categories/route';
import { PUT as PUT_CATEGORY, DELETE as DELETE_CATEGORY } from '@/app/api/categories/[id]/route';
import { db } from '@/lib/db';
import { budgetCategories } from '@/lib/db/schema';

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/api/household-auth', () => ({
  getHouseholdIdFromRequest: vi.fn(),
  requireHouseholdAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(),
}));

import { requireAuth } from '@/lib/auth-helpers';
import { getHouseholdIdFromRequest, requireHouseholdAuth } from '@/lib/api/household-auth';
import { nanoid } from 'nanoid';

const TEST_USER_ID = 'user-123';
const TEST_HOUSEHOLD_ID = 'household-456';

function createMockRequest(body?: any, headers?: Record<string, string>): Request {
  return {
    json: async () => body ?? {},
    headers: new Headers(headers ?? {}),
  } as Request;
}

function createMockParams(id: string) {
  return Promise.resolve({ id });
}

function mockSelectLimit(result: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function mockSelectOrderBy(result: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function mockSelectWhere(result: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(result),
    }),
  };
}

describe('Categories API - Subcategories (budget groups)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID });
    (getHouseholdIdFromRequest as any).mockReturnValue(TEST_HOUSEHOLD_ID);
    (requireHouseholdAuth as any).mockResolvedValue({ role: 'owner' });
    (nanoid as any).mockReturnValue('cat-id-1');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GET should return categories (including parentId/isBudgetGroup fields) for the household', async () => {
    const rows = [
      { id: 'group-1', householdId: TEST_HOUSEHOLD_ID, userId: TEST_USER_ID, name: 'Needs', type: 'expense', isBudgetGroup: true, parentId: null },
      { id: 'child-1', householdId: TEST_HOUSEHOLD_ID, userId: TEST_USER_ID, name: 'Groceries', type: 'expense', isBudgetGroup: false, parentId: 'group-1' },
    ];

    (db.select as any).mockReturnValue(mockSelectOrderBy(rows));

    const request = createMockRequest(undefined, { 'x-household-id': TEST_HOUSEHOLD_ID });
    const response = await GET_CATEGORIES(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(rows);
  });

  it('POST should reject budget groups with a parentId', async () => {
    const request = createMockRequest({
      householdId: TEST_HOUSEHOLD_ID,
      name: 'Needs',
      type: 'expense',
      isBudgetGroup: true,
      parentId: 'some-parent',
    });

    const response = await POST_CATEGORIES(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Budget groups cannot have a parent');
  });

  it('POST should create a budget group (parent category) successfully', async () => {
    (nanoid as any).mockReturnValueOnce('group-1');

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db.insert as any).mockImplementation(mockInsert);

    // Duplicate name check
    (db.select as any).mockReturnValueOnce(mockSelectLimit([]));

    const request = createMockRequest({
      householdId: TEST_HOUSEHOLD_ID,
      name: 'Needs',
      type: 'expense',
      isBudgetGroup: true,
      targetAllocation: 50,
    });

    const response = await POST_CATEGORIES(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe('group-1');
    expect(data.isBudgetGroup).toBe(true);
    expect(data.parentId).toBe(null);
    expect(data.monthlyBudget).toBe(0);
    expect(data.targetAllocation).toBe(50);
    expect(mockInsert).toHaveBeenCalledWith(budgetCategories);
  });

  it('POST should reject subcategory when parent does not exist', async () => {
    // 1) parent validation lookup returns []
    // 2) duplicate name check not reached due to 404
    (db.select as any).mockReturnValueOnce(mockSelectLimit([]));

    const request = createMockRequest({
      householdId: TEST_HOUSEHOLD_ID,
      name: 'Groceries',
      type: 'expense',
      parentId: 'missing-parent',
    });

    const response = await POST_CATEGORIES(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Parent category not found');
  });

  it('POST should reject subcategory when parent is not a budget group', async () => {
    (db.select as any)
      // parent validation lookup
      .mockReturnValueOnce(mockSelectLimit([{ id: 'parent-1', isBudgetGroup: false, type: 'expense' }]));

    const request = createMockRequest({
      householdId: TEST_HOUSEHOLD_ID,
      name: 'Groceries',
      type: 'expense',
      parentId: 'parent-1',
    });

    const response = await POST_CATEGORIES(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Parent must be a budget group');
  });

  it('POST should reject subcategory when parent type does not match', async () => {
    (db.select as any)
      // parent validation lookup
      .mockReturnValueOnce(mockSelectLimit([{ id: 'parent-1', isBudgetGroup: true, type: 'income' }]));

    const request = createMockRequest({
      householdId: TEST_HOUSEHOLD_ID,
      name: 'Groceries',
      type: 'expense',
      parentId: 'parent-1',
    });

    const response = await POST_CATEGORIES(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Parent category type must match category type');
  });

  it('POST should create a subcategory when parent is a matching budget group', async () => {
    (nanoid as any).mockReturnValueOnce('child-1');

    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
    (db.insert as any).mockImplementation(mockInsert);

    (db.select as any)
      // parent validation lookup
      .mockReturnValueOnce(mockSelectLimit([{ id: 'group-1', isBudgetGroup: true, type: 'expense' }]))
      // duplicate name check
      .mockReturnValueOnce(mockSelectLimit([]));

    const request = createMockRequest({
      householdId: TEST_HOUSEHOLD_ID,
      name: 'Groceries',
      type: 'expense',
      parentId: 'group-1',
      monthlyBudget: 250,
    });

    const response = await POST_CATEGORIES(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe('child-1');
    expect(data.parentId).toBe('group-1');
    expect(data.isBudgetGroup).toBe(false);
    expect(data.monthlyBudget).toBe(250);
    expect(mockInsert).toHaveBeenCalledWith(budgetCategories);
  });
});

describe('Category API - Update constraints for subcategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID });
    (getHouseholdIdFromRequest as any).mockReturnValue(TEST_HOUSEHOLD_ID);
    (requireHouseholdAuth as any).mockResolvedValue({ role: 'owner' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('PUT should reject setting a category as its own parent', async () => {
    const current = {
      id: 'child-1',
      userId: TEST_USER_ID,
      householdId: TEST_HOUSEHOLD_ID,
      name: 'Groceries',
      type: 'expense',
      isBudgetGroup: false,
      parentId: null,
    };

    (db.select as any).mockReturnValueOnce(mockSelectLimit([current]));

    const request = createMockRequest({
      householdId: TEST_HOUSEHOLD_ID,
      parentId: 'child-1',
    });
    const response = await PUT_CATEGORY(request, { params: createMockParams('child-1') });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('A category cannot be its own parent');
  });

  it('PUT should allow assigning a valid parent budget group of same type', async () => {
    const current = {
      id: 'child-1',
      userId: TEST_USER_ID,
      householdId: TEST_HOUSEHOLD_ID,
      name: 'Groceries',
      type: 'expense',
      isBudgetGroup: false,
      parentId: null,
      monthlyBudget: 100,
      isTaxDeductible: false,
      isBusinessCategory: false,
      incomeFrequency: 'variable',
      dueDate: null,
      targetAllocation: null,
    };

    (db.select as any)
      // load current category
      .mockReturnValueOnce(mockSelectLimit([current]))
      // validate parent
      .mockReturnValueOnce(mockSelectLimit([{ id: 'group-1', isBudgetGroup: true, type: 'expense' }]));

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    (db.update as any).mockImplementation(mockUpdate);

    const request = createMockRequest({
      householdId: TEST_HOUSEHOLD_ID,
      parentId: 'group-1',
    });

    const response = await PUT_CATEGORY(request, { params: createMockParams('child-1') });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Category updated successfully');
    expect(mockUpdate).toHaveBeenCalledWith(budgetCategories);
  });

  it('PUT should reject changing type when existing parent type would no longer match (without clearing parent)', async () => {
    const current = {
      id: 'child-1',
      userId: TEST_USER_ID,
      householdId: TEST_HOUSEHOLD_ID,
      name: 'Groceries',
      type: 'expense',
      isBudgetGroup: false,
      parentId: 'group-1',
      monthlyBudget: 100,
      isTaxDeductible: false,
      isBusinessCategory: false,
      incomeFrequency: 'variable',
      dueDate: null,
      targetAllocation: null,
    };

    (db.select as any)
      // load current category
      .mockReturnValueOnce(mockSelectLimit([current]))
      // verify existing parent still matches new type
      .mockReturnValueOnce(mockSelectLimit([{ id: 'group-1', type: 'expense' }]));

    const request = createMockRequest({
      householdId: TEST_HOUSEHOLD_ID,
      type: 'income',
    });

    const response = await PUT_CATEGORY(request, { params: createMockParams('child-1') });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Category type changed; clear parent category or select a matching parent');
  });
});

describe('Category API - Delete behavior for budget groups/subcategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue({ userId: TEST_USER_ID });
    (getHouseholdIdFromRequest as any).mockReturnValue(TEST_HOUSEHOLD_ID);
    (requireHouseholdAuth as any).mockResolvedValue({ role: 'owner' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('DELETE should orphan children before deleting a budget group', async () => {
    const group = {
      id: 'group-1',
      userId: TEST_USER_ID,
      householdId: TEST_HOUSEHOLD_ID,
      isBudgetGroup: true,
    };

    (db.select as any).mockReturnValueOnce(mockSelectLimit([group]));

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    (db.update as any).mockImplementation(mockUpdate);

    const mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    (db.delete as any).mockImplementation(mockDelete);

    const request = createMockRequest(undefined, { 'x-household-id': TEST_HOUSEHOLD_ID });
    const response = await DELETE_CATEGORY(request, { params: createMockParams('group-1') });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Category deleted successfully');
    expect(mockUpdate).toHaveBeenCalledWith(budgetCategories);
    expect(mockDelete).toHaveBeenCalledWith(budgetCategories);
  });

  it('DELETE should block deleting a subcategory if it is used by transactions in the household', async () => {
    const child = {
      id: 'child-1',
      userId: TEST_USER_ID,
      householdId: TEST_HOUSEHOLD_ID,
      isBudgetGroup: false,
    };

    (db.select as any)
      // load category
      .mockReturnValueOnce(mockSelectLimit([child]))
      // usageCount query
      .mockReturnValueOnce(mockSelectWhere([{ count: 2 }]));

    const request = createMockRequest(undefined, { 'x-household-id': TEST_HOUSEHOLD_ID });
    const response = await DELETE_CATEGORY(request, { params: createMockParams('child-1') });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Cannot delete category. It is used by 2 transaction(s) in this household.');
    expect(db.delete).not.toHaveBeenCalled();
  });
});


