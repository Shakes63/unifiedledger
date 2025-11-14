/**
 * SMTP Email Provider (Nodemailer)
 *
 * Implementation of email sending using traditional SMTP with Nodemailer.
 * This provider is ideal for self-hosting scenarios where users want full control.
 *
 * Features:
 * - Works with any SMTP server (Gmail, Outlook, self-hosted, etc.)
 * - No third-party dependencies (besides SMTP server)
 * - Full control over email delivery
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getEmailConfig } from '../email-config';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

let transporter: Transporter | null = null;

/**
 * Get or create SMTP transporter
 */
function getTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  const config = getEmailConfig();

  if (!config.smtp) {
    throw new Error('SMTP configuration not found');
  }

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.password,
    },
  });

  return transporter;
}

/**
 * Send email using SMTP/Nodemailer
 */
export async function sendWithSMTP(options: SendEmailOptions): Promise<void> {
  const config = getEmailConfig();

  if (!config.smtp) {
    throw new Error('SMTP not configured');
  }

  try {
    const transport = getTransporter();
    const from = options.from || `${config.from.name} <${config.from.email}>`;

    const info = await transport.sendMail({
      from,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });

    console.log('[SMTP] Email sent successfully:', info.messageId);
  } catch (error) {
    console.error('[SMTP] Error sending email:', error);
    throw error;
  }
}

/**
 * Verify SMTP connection (useful for testing configuration)
 */
export async function verifySMTPConnection(): Promise<boolean> {
  try {
    const transport = getTransporter();
    await transport.verify();
    console.log('[SMTP] Connection verified successfully');
    return true;
  } catch (error) {
    console.error('[SMTP] Connection verification failed:', error);
    return false;
  }
}
