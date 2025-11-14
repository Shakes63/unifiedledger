/**
 * Resend Email Provider
 *
 * Implementation of email sending using Resend API.
 * Resend is the recommended provider for its simplicity and reliability.
 *
 * Features:
 * - Simple API with just an API key
 * - Better deliverability than SMTP
 * - React Email integration
 * - Generous free tier (100 emails/day, 3,000/month)
 */

import { Resend } from 'resend';
import { getEmailConfig } from '../email-config';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/**
 * Send email using Resend
 */
export async function sendWithResend(options: SendEmailOptions): Promise<void> {
  const config = getEmailConfig();

  if (!config.resend?.apiKey) {
    throw new Error('Resend API key not configured');
  }

  const resend = new Resend(config.resend.apiKey);

  try {
    const from = options.from || `${config.from.name} <${config.from.email}>`;

    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });

    if (error) {
      console.error('[Resend] Failed to send email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log('[Resend] Email sent successfully:', data?.id);
  } catch (error) {
    console.error('[Resend] Error sending email:', error);
    throw error;
  }
}
