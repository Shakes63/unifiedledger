/**
 * Email Configuration
 *
 * Centralized configuration for email providers (Resend and SMTP/Nodemailer).
 * Checks environment variables and provides helpers to determine which provider to use.
 */

export type EmailProvider = 'resend' | 'smtp' | 'none';

export interface EmailConfig {
  provider: EmailProvider;
  from: {
    email: string;
    name: string;
  };
  resend?: {
    apiKey: string;
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
  };
}

/**
 * Get email configuration from environment variables
 */
export function getEmailConfig(): EmailConfig {
  const provider = (process.env.EMAIL_PROVIDER?.toLowerCase() || 'resend') as EmailProvider;

  // Resend configuration
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const resendFromName = process.env.RESEND_FROM_NAME || 'Unified Ledger';

  // SMTP configuration
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpSecure = process.env.SMTP_SECURE === 'true';
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM || 'noreply@localhost';
  const smtpFromName = process.env.SMTP_FROM_NAME || 'Unified Ledger';

  // Determine active provider strictly from EMAIL_PROVIDER selection.
  let actualProvider: EmailProvider = 'none';

  if (provider === 'resend' && resendApiKey) {
    actualProvider = 'resend';
  } else if (provider === 'smtp' && smtpHost && smtpUser && smtpPassword) {
    actualProvider = 'smtp';
  }

  return {
    provider: actualProvider,
    from: {
      email: actualProvider === 'resend' ? resendFromEmail : smtpFrom,
      name: actualProvider === 'resend' ? resendFromName : smtpFromName,
    },
    resend: resendApiKey
      ? {
          apiKey: resendApiKey,
        }
      : undefined,
    smtp:
      smtpHost && smtpUser && smtpPassword
        ? {
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            user: smtpUser,
            password: smtpPassword,
          }
        : undefined,
  };
}

/**
 * Check if email is configured and ready to use
 */
export function isEmailConfigured(): boolean {
  const config = getEmailConfig();
  return config.provider !== 'none';
}

/**
 * Get the active email provider
 */
export function getEmailProvider(): EmailProvider {
  const config = getEmailConfig();
  return config.provider;
}

/**
 * Get application base URL for links in emails
 */
export function getAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL must be configured');
  }
  return appUrl;
}
