import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { Sidebar } from '@/components/navigation/sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}));

vi.mock('@/context/navigation-context', () => ({
  useNavigation: () => ({
    sidebarOpen: false,
    toggleSidebar: vi.fn(),
  }),
}));

vi.mock('@/contexts/developer-mode-context', () => ({
  useDeveloperMode: () => ({
    isDeveloperMode: false,
  }),
}));

vi.mock('@/contexts/business-features-context', () => ({
  useBusinessFeatures: () => ({
    hasSalesTaxAccounts: false,
    hasTaxDeductionAccounts: false,
  }),
}));

vi.mock('@/components/household/household-selector', () => ({
  HouseholdSelector: () => <div />,
}));

vi.mock('@/components/auth/user-menu', () => ({
  UserMenu: () => <div />,
}));

vi.mock('@/components/notifications/notification-bell', () => ({
  NotificationBell: () => <div />,
}));

vi.mock('@/components/dev/test-mode-badge', () => ({
  TestModeBadge: () => null,
  TestModeBadgeCompact: () => null,
}));

describe('Sidebar (collapsed)', () => {
  it('uses a vertical header layout so the collapse toggle stays within the rail (regression)', () => {
    render(<Sidebar />);

    const header = screen.getByTestId('sidebar-header');
    expect(header.className).toContain('flex-col');
    expect(header.className).toContain('items-center');

    expect(screen.getByTestId('sidebar-collapse-toggle')).toBeInTheDocument();
  });
});


