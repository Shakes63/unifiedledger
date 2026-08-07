import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AllocationTrendsChart } from '@/components/budget-summary/allocation-trends-chart';

/**
 * Mount regression for the recharts 3.10 upgrade: the Tooltip `content` moved
 * from a typed function wrapper to the element form used by the rest of the
 * charts. A render crash here means the chart/tooltip wiring broke.
 */
describe('AllocationTrendsChart', () => {
  const data = {
    months: ['2026-05', '2026-06', '2026-07'],
    income: [5000, 5200, 5100],
    expenses: [3200, 3400, 3100],
    savings: [800, 800, 900],
    surplus: [1000, 1000, 1100],
  };

  it('mounts with series toggles and no crash', () => {
    render(<AllocationTrendsChart data={data} />);
    expect(screen.getAllByText('Income').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Expenses').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Savings').length).toBeGreaterThan(0);
  });

  it('mounts with empty data without crashing', () => {
    render(
      <AllocationTrendsChart
        data={{ months: [], income: [], expenses: [], savings: [], surplus: [] }}
      />
    );
  });
});
