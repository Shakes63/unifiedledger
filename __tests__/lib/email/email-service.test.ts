/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/email/email-config', () => ({
  getEmailConfig: vi.fn(),
  isEmailConfigured: vi.fn(),
}));

vi.mock('@/lib/email/providers/resend-provider', () => ({
  sendWithResend: vi.fn(),
}));

vi.mock('@/lib/email/providers/smtp-provider', () => ({
  sendWithSMTP: vi.fn(),
}));

import { getEmailConfig, isEmailConfigured } from '@/lib/email/email-config';
import { sendWithResend } from '@/lib/email/providers/resend-provider';
import { sendWithSMTP } from '@/lib/email/providers/smtp-provider';
import { sendEmail } from '@/lib/email/email-service';

describe('lib/email/email-service sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (isEmailConfigured as any).mockReturnValue(true);
    (getEmailConfig as any).mockReturnValue({
      provider: 'resend',
      from: { email: 'from@example.com', name: 'From' },
      resend: { apiKey: 'rk' },
      smtp: {
        host: 'smtp',
        port: 587,
        secure: false,
        user: 'u',
        password: 'p',
      },
    });
    (sendWithResend as any).mockResolvedValue(undefined);
    (sendWithSMTP as any).mockResolvedValue(undefined);
  });

  it('no-ops when email is not configured', async () => {
    (isEmailConfigured as any).mockReturnValue(false);

    await expect(
      sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' })
    ).resolves.toBeUndefined();

    expect(sendWithResend).not.toHaveBeenCalled();
    expect(sendWithSMTP).not.toHaveBeenCalled();
  });

  it('uses configured provider when it succeeds', async () => {
    (getEmailConfig as any).mockReturnValue({
      provider: 'resend',
      from: { email: 'from@example.com', name: 'From' },
      resend: { apiKey: 'rk' },
      smtp: undefined,
    });

    await expect(
      sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' })
    ).resolves.toBeUndefined();

    expect(sendWithResend).toHaveBeenCalledTimes(1);
    expect(sendWithSMTP).not.toHaveBeenCalled();
  });

  it('falls back to SMTP when Resend fails and SMTP is configured', async () => {
    (getEmailConfig as any).mockReturnValue({
      provider: 'resend',
      from: { email: 'from@example.com', name: 'From' },
      resend: { apiKey: 'rk' },
      smtp: {
        host: 'smtp',
        port: 587,
        secure: false,
        user: 'u',
        password: 'p',
      },
    });
    (sendWithResend as any).mockRejectedValue(new Error('resend down'));

    await expect(
      sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' })
    ).resolves.toBeUndefined();

    expect(sendWithResend).toHaveBeenCalledTimes(1);
    expect(sendWithSMTP).toHaveBeenCalledTimes(1);
  });

  it('falls back to Resend when SMTP fails and Resend is configured', async () => {
    (getEmailConfig as any).mockReturnValue({
      provider: 'smtp',
      from: { email: 'from@example.com', name: 'From' },
      resend: { apiKey: 'rk' },
      smtp: {
        host: 'smtp',
        port: 587,
        secure: false,
        user: 'u',
        password: 'p',
      },
    });
    (sendWithSMTP as any).mockRejectedValue(new Error('smtp down'));

    await expect(
      sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' })
    ).resolves.toBeUndefined();

    expect(sendWithSMTP).toHaveBeenCalledTimes(1);
    expect(sendWithResend).toHaveBeenCalledTimes(1);
  });

  it('throws when primary fails and no fallback is available', async () => {
    (getEmailConfig as any).mockReturnValue({
      provider: 'resend',
      from: { email: 'from@example.com', name: 'From' },
      resend: { apiKey: 'rk' },
      smtp: undefined,
    });
    (sendWithResend as any).mockRejectedValue(new Error('resend down'));

    await expect(
      sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' })
    ).rejects.toThrow('resend down');

    expect(sendWithSMTP).not.toHaveBeenCalled();
  });
});
