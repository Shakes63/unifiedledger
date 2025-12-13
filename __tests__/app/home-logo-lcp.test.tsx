import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Capture props passed to next/image for assertions.
const nextImageMock = vi.fn((props: { alt?: string }) => {
  // Avoid <img> to satisfy @next/next/no-img-element in tests.
  return <div data-testid="next-image-mock" aria-label={props.alt ?? ''} />;
});

vi.mock('next/image', async () => {
  return { default: (props: unknown) => nextImageMock(props as never) };
});

vi.mock('next/navigation', async () => {
  return {
    redirect: vi.fn(),
  };
});

vi.mock('@/lib/better-auth', async () => {
  return {
    auth: {
      api: {
        getSession: vi.fn(async () => null),
      },
    },
  };
});

vi.mock('@/lib/auth/owner-helpers', async () => {
  return {
    isFirstUser: vi.fn(async () => false),
  };
});

import Home from '@/app/page';

describe('Home page LCP logo', () => {
  beforeEach(() => {
    nextImageMock.mockClear();
  });

  it('marks the above-the-fold logo as priority (eager)', async () => {
    render(await Home());

    expect(screen.getByLabelText(/unifiedledger logo/i)).toBeInTheDocument();

    expect(nextImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        src: '/logo.png',
        priority: true,
      })
    );
  });
});


