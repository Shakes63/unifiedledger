import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { HouseholdSelector } from '@/components/household/household-selector';

const pushMock = vi.fn();

vi.mock('next/navigation', async () => {
  return {
    useRouter: () => ({ push: pushMock }),
  };
});

vi.mock('@/contexts/household-context', async () => {
  return {
    useHousehold: () => ({
      households: [
        {
          id: 'hh_1',
          name: 'Home',
          joinedAt: '2025-01-01T00:00:00.000Z',
          isFavorite: false,
        },
      ],
      selectedHouseholdId: 'hh_1',
      loading: false,
      preferencesLoading: false,
      setSelectedHouseholdId: vi.fn(),
    }),
  };
});

describe('HouseholdSelector', () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it('routes Manage Households to the households settings section for the selected household', async () => {
    render(<HouseholdSelector />);

    fireEvent.pointerDown(screen.getByRole('button', { name: /home/i }));
    fireEvent.click(await screen.findByText(/manage households/i));

    expect(pushMock).toHaveBeenCalledWith(
      '/dashboard/settings?section=households&household=hh_1&tab=members'
    );
  });
});


