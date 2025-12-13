import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { RulesManager } from '@/components/rules/rules-manager';

const fetchWithHouseholdMock = vi.fn();

vi.mock('@/contexts/household-context', async () => {
  return {
    useHousehold: () => ({
      selectedHouseholdId: 'hh_1',
    }),
  };
});

vi.mock('@/lib/hooks/use-household-fetch', async () => {
  return {
    useHouseholdFetch: () => ({
      fetchWithHousehold: fetchWithHouseholdMock,
      postWithHousehold: vi.fn(),
      putWithHousehold: vi.fn(),
      deleteWithHousehold: vi.fn(),
    }),
  };
});

vi.mock('sonner', async () => {
  return {
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('@/lib/help/toast-with-help', async () => {
  return {
    toastInfoWithHelp: vi.fn(),
  };
});

function okJson<T>(data: T): Response {
  return {
    ok: true,
    json: async () => data,
  } as unknown as Response;
}

describe('RulesManager categories fetch', () => {
  beforeEach(() => {
    fetchWithHouseholdMock.mockReset();

    fetchWithHouseholdMock.mockImplementation(async (url: string) => {
      if (url === '/api/rules') {
        return okJson([
          {
            id: 'r_1',
            name: 'Rule 1',
            priority: 1,
            isActive: true,
            matchCount: 0,
            actions: [],
            categoryId: 'cat_1',
          },
          {
            id: 'r_2',
            name: 'Rule 2',
            priority: 2,
            isActive: true,
            matchCount: 0,
            actions: [],
            categoryId: 'cat_2',
          },
        ]);
      }

      if (url === '/api/categories') {
        return okJson([
          { id: 'cat_1', name: 'Groceries' },
          { id: 'cat_2', name: 'Rent' },
        ]);
      }

      throw new Error(`Unexpected fetchWithHousehold url: ${url}`);
    });
  });

  it('fetches /api/categories only once for multiple rules', async () => {
    render(<RulesManager />);

    await screen.findByText('Rule 1');
    await screen.findByText('Rule 2');

    const categoryCalls = fetchWithHouseholdMock.mock.calls.filter(call => call[0] === '/api/categories');
    expect(categoryCalls).toHaveLength(1);
  });
});
