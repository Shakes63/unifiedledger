import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { TransferSuggestionsModal } from '@/components/transactions/transfer-suggestions-modal';

vi.mock('@/lib/hooks/use-household-fetch', () => ({
  useHouseholdFetch: () => ({
    selectedHouseholdId: 'hh-test',
    fetchWithHousehold: (url: string, options?: RequestInit) => fetch(url, options),
    postWithHousehold: (url: string, data: Record<string, unknown>, options?: RequestInit) =>
      fetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        ...options,
      }),
  }),
}));

describe('TransferSuggestionsModal', () => {
  beforeEach(() => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as unknown as Response);
  });

  it('uses Tailwind v4 CSS variable shorthand for primary icon color', async () => {
    render(<TransferSuggestionsModal open={true} onOpenChange={() => {}} />);

    const titleText = await screen.findByText(/transfer match suggestions/i);
    const titleEl = titleText.closest('h2') ?? titleText.parentElement;

    expect(titleEl).not.toBeNull();

    const icon = titleEl!.querySelector('svg');
    expect(icon).not.toBeNull();

    expect(icon).toHaveClass('text-primary');
  });
});
