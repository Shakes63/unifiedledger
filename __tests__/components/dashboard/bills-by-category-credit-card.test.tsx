import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { BillsByClassificationWidget } from '@/components/dashboard/bills-by-classification-widget';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Cell: () => <div />,
  Tooltip: () => <div />,
}));

vi.mock('@/contexts/household-context', () => ({
  useHousehold: () => ({
    selectedHouseholdId: 'hh_1',
  }),
}));

const fetchWithHouseholdMock = vi.fn();

vi.mock('@/lib/hooks/use-household-fetch', () => ({
  useHouseholdFetch: () => ({
    fetchWithHousehold: fetchWithHouseholdMock,
  }),
}));

describe('BillsByClassificationWidget (Dashboard Bills by Category)', () => {
  beforeEach(() => {
    fetchWithHouseholdMock.mockReset();
  });

  it('renders a loan payment category row when the API returns it (regression)', async () => {
    fetchWithHouseholdMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            classification: 'loan_payment',
            label: 'Loan Payment',
            count: 1,
            totalMonthly: 123,
            upcomingCount: 1,
            upcomingAmount: 123,
            color: '#3366ff',
          },
        ],
        totals: {
          totalCount: 1,
          totalMonthly: 123,
          totalUpcomingCount: 1,
          totalUpcomingAmount: 123,
        },
      }),
    });

    render(<BillsByClassificationWidget />);

    expect(await screen.findByText('Loan Payment')).toBeInTheDocument();
    expect(screen.getByText('$123.00')).toBeInTheDocument();
  });
});


