import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import SettingsPage from '@/app/dashboard/settings/page';

const pushMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('next/navigation', async () => {
  return {
    useRouter: () => ({ push: pushMock }),
    useSearchParams: () => ({
      get: (key: string) => {
        // Keep the page on the households section, but avoid needing a specific household selected.
        if (key === 'section') return 'households';
        if (key === 'tab') return 'members';
        if (key === 'household') return 'hh_1';
        return null;
      },
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

// Stub heavy tab components to avoid side-effectful fetches during render.
vi.mock('@/components/settings/profile-tab', async () => ({ ProfileTab: () => <div /> }));
vi.mock('@/components/settings/preferences-tab', async () => ({ PreferencesTab: () => <div /> }));
vi.mock('@/components/settings/privacy-tab', async () => ({ PrivacyTab: () => <div /> }));
vi.mock('@/components/settings/data-tab', async () => ({ DataTab: () => <div /> }));
vi.mock('@/components/settings/advanced-tab', async () => ({ AdvancedTab: () => <div /> }));
vi.mock('@/components/settings/admin-tab', async () => ({ AdminTab: () => <div /> }));
vi.mock('@/components/settings/household-members-tab', async () => ({ HouseholdMembersTab: () => <div /> }));
vi.mock('@/components/settings/household-preferences-tab', async () => ({ HouseholdPreferencesTab: () => <div /> }));
vi.mock('@/components/settings/household-financial-tab', async () => ({ HouseholdFinancialTab: () => <div /> }));
vi.mock('@/components/settings/household-personal-tab', async () => ({ HouseholdPersonalTab: () => <div /> }));
vi.mock('@/components/settings/tax-mapping-tab', async () => ({ TaxMappingTab: () => <div /> }));
vi.mock('@/components/settings/notifications-tab', async () => ({ NotificationsTab: () => <div /> }));

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
      selectedHousehold: {
        id: 'hh_1',
        name: 'Home',
        joinedAt: '2025-01-01T00:00:00.000Z',
        isFavorite: false,
      },
      refreshHouseholds: vi.fn(),
      loading: false,
    }),
  };
});

describe('SettingsPage - Create Household', () => {
  beforeEach(() => {
    pushMock.mockReset();
    fetchMock.mockReset();
    // @ts-expect-error - test override
    global.fetch = fetchMock;
  });

  it('includes credentials: include when creating a household', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'hh_new', name: 'My Household' }),
    });

    render(<SettingsPage />);

    fireEvent.click(screen.getByText(/create new/i));
    fireEvent.change(screen.getByLabelText(/household name/i), { target: { value: '  My Household  ' } });
    fireEvent.click(screen.getByRole('button', { name: /create household/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/households',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });

    // Also ensure the payload was trimmed.
    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/households' && c[1]?.method === 'POST');
    expect(call?.[1]?.body).toBe(JSON.stringify({ name: 'My Household' }));
  });
});


