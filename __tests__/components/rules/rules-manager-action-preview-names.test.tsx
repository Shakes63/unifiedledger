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

describe('RulesManager action preview name hydration', () => {
  beforeEach(() => {
    fetchWithHouseholdMock.mockReset();

    fetchWithHouseholdMock.mockImplementation(async (url: string) => {
      if (url === '/api/rules') {
        return okJson([
          {
            id: 'r_merchant',
            name: 'Merchant rule',
            priority: 1,
            isActive: true,
            matchCount: 0,
            actions: [{ type: 'set_merchant', value: 'm_1' }],
          },
          {
            id: 'r_transfer',
            name: 'Transfer rule',
            priority: 2,
            isActive: true,
            matchCount: 0,
            actions: [{ type: 'convert_to_transfer', config: { targetAccountId: 'a_1' } }],
          },
          {
            id: 'r_account',
            name: 'Account rule',
            priority: 3,
            isActive: true,
            matchCount: 0,
            actions: [{ type: 'set_account', value: 'a_2' }],
          },
        ]);
      }

      if (url === '/api/categories') {
        return okJson([]);
      }

      if (url === '/api/merchants') {
        return okJson([{ id: 'm_1', name: 'Acme Market' }]);
      }

      if (url === '/api/accounts') {
        return okJson([
          { id: 'a_1', name: 'Checking' },
          { id: 'a_2', name: 'Savings' },
        ]);
      }

      throw new Error(`Unexpected fetchWithHousehold url: ${url}`);
    });
  });

  it('shows merchant/account names instead of Unknown', async () => {
    render(<RulesManager />);

    await screen.findByText('Merchant rule');

    expect(await screen.findByText(/Merchant: Acme Market/i)).toBeInTheDocument();
    expect(await screen.findByText(/Transfer to Checking/i)).toBeInTheDocument();
    expect(await screen.findByText(/Move to Savings/i)).toBeInTheDocument();

    expect(screen.queryByText(/Merchant: Unknown/i)).toBeNull();
  });
});
