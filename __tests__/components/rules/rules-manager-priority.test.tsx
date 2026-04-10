import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { RulesManager } from '@/components/rules/rules-manager';

const fetchWithHouseholdMock = vi.fn();
const putWithHouseholdMock = vi.fn();

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
      putWithHousehold: putWithHouseholdMock,
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

describe('RulesManager priority reordering', () => {
  beforeEach(() => {
    fetchWithHouseholdMock.mockReset();
    putWithHouseholdMock.mockReset();

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
          },
          {
            id: 'r_2',
            name: 'Rule 2',
            priority: 2,
            isActive: true,
            matchCount: 0,
            actions: [],
          },
        ]);
      }

      if (url === '/api/categories') {
        return okJson([] as Array<{ id: string; name: string }>);
      }

      throw new Error(`Unexpected fetchWithHousehold url: ${url}`);
    });

    putWithHouseholdMock.mockResolvedValue(okJson({}));
  });

  it('swaps priorities without creating duplicates', async () => {
    render(<RulesManager />);

    await screen.findByText('Rule 1');
    await screen.findByText('Rule 2');

    const moveDownButtons = screen.getAllByTitle(/lower priority/i);
    expect(moveDownButtons.length).toBeGreaterThan(0);

    fireEvent.click(moveDownButtons[0]);

    await waitFor(() => {
      // After swap, both priority numbers should still appear exactly once (01 and 02)
      expect(screen.getAllByText('01')).toHaveLength(1);
      expect(screen.getAllByText('02')).toHaveLength(1);
    });

    expect(putWithHouseholdMock).toHaveBeenNthCalledWith(1, '/api/rules', {
      id: 'r_1',
      priority: 2,
    });

    expect(putWithHouseholdMock).toHaveBeenNthCalledWith(2, '/api/rules', {
      id: 'r_2',
      priority: 1,
    });
  });
});
