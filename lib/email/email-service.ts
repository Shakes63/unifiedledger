/**
 * Email Service
 *
 * High-level email sending service that abstracts away provider details.
 * Supports both Resend (recommended) and SMTP (for self-hosting).
 *
 * Usage:
 *   await sendVerificationEmail({ to, userName, verificationUrl })
 *   await sendEmailChangeVerification({ to, userName, verificationUrl, newEmail })
 *
 * The service will automatically:
 * - Choose the configured provider (Resend or SMTP)
 * - Handle errors gracefully
 * - Log email sending for debugging
 * - Fall back gracefully if email is not configured
 */

import { getEmailConfig, isEmailConfigured } from './email-config';
import { sendWithResend } from './providers/resend-provider';
import { sendWithSMTP } from './providers/smtp-provider';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

/**
 * Core email sending function
 * Automatically routes to the configured provider (Resend or SMTP)
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn('[Email] Email not configured - skipping email send');
    console.warn('[Email] To:', options.to, 'Subject:', options.subject);
    return;
  }

  const config = getEmailConfig();

  try {
    if (config.provider === 'resend') {
      await sendWithResend(options);
    } else if (config.provider === 'smtp') {
      await sendWithSMTP(options);
    } else {
      throw new Error('No email provider configured');
    }
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    throw error;
  }
}

/**
 * Send email verification email
 *
 * Called when:
 * - User signs up with a new account
 * - User requests to resend verification email
 *
 * @param to - User's email address
 * @param userName - User's display name
 * @param verificationUrl - Full URL to verification endpoint with token
 */
export async function sendVerificationEmail({
  to,
  userName,
  verificationUrl,
}: {
  to: string;
  userName: string;
  verificationUrl: string;
}): Promise<void> {
  // For now, use simple HTML template
  // Will be replaced with React Email template in Phase 3
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify your email address</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #10b981;
            margin: 0;
            font-size: 24px;
          }
          .content {
            margin-bottom: 30px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #10b981;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            text-align: center;
          }
          .button:hover {
            background-color: #059669;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
          }
          .link {
            color: #10b981;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your Email Address</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Thanks for signing up for Unified Ledger! To complete your registration and access all features, please verify your email address by clicking the button below:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${verificationUrl}" class="link">${verificationUrl}</a></p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create an account with Unified Ledger, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The Unified Ledger Team</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Hi ${userName},

Thanks for signing up for Unified Ledger! To complete your registration and access all features, please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account with Unified Ledger, you can safely ignore this email.

Best regards,
The Unified Ledger Team
  `.trim();

  await sendEmail({
    to,
    subject: 'Verify your email address - Unified Ledger',
    html,
    text,
  });

  console.log('[Email] Verification email sent to:', to);
}

/**
 * Send email change verification email
 *
 * Called when:
 * - User changes their email address and needs to verify the new one
 *
 * @param to - New email address to verify
 * @param userName - User's display name
 * @param verificationUrl - Full URL to verification endpoint with token
 * @param oldEmail - User's current email address (for context)
 */
export async function sendEmailChangeVerification({
  to,
  userName,
  verificationUrl,
  oldEmail,
}: {
  to: string;
  userName: string;
  verificationUrl: string;
  oldEmail: string;
}): Promise<void> {
  // For now, use simple HTML template
  // Will be replaced with React Email template in Phase 3
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify your new email address</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #10b981;
            margin: 0;
            font-size: 24px;
          }
          .content {
            margin-bottom: 30px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #10b981;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            text-align: center;
          }
          .button:hover {
            background-color: #059669;
          }
          .info-box {
            background-color: #f3f4f6;
            border-left: 4px solid #10b981;
            padding: 16px;
            margin: 20px 0;
          }
          .warning-box {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
          }
          .link {
            color: #10b981;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your New Email Address</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>You recently requested to change your email address for your Unified Ledger account.</p>
            <div class="info-box">
              <strong>Email Change Request:</strong><br>
              From: ${oldEmail}<br>
              To: ${to}
            </div>
            <p>To complete this change, please verify your new email address by clicking the button below:</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" class="button">Verify New Email</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${verificationUrl}" class="link">${verificationUrl}</a></p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <div class="warning-box">
              <strong>Security Notice:</strong> If you didn't request this email change, please ignore this email and contact support immediately. Your current email address will remain unchanged.
            </div>
          </div>
          <div class="footer">
            <p>Best regards,<br>The Unified Ledger Team</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Hi ${userName},

You recently requested to change your email address for your Unified Ledger account.

Email Change Request:
From: ${oldEmail}
To: ${to}

To complete this change, please verify your new email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

SECURITY NOTICE: If you didn't request this email change, please ignore this email and contact support immediately. Your current email address will remain unchanged.

Best regards,
The Unified Ledger Team
  `.trim();

  await sendEmail({
    to,
    subject: 'Verify your new email address - Unified Ledger',
    html,
    text,
  });

  console.log('[Email] Email change verification sent to:', to);
}

/**
 * Send household invitation email
 *
 * Called when:
 * - User invites another user to join a household
 *
 * @param to - Invited user's email address
 * @param invitedBy - Name of the user who sent the invitation
 * @param householdName - Name of the household being invited to
 * @param invitationUrl - Full URL to invitation acceptance page with token
 * @param role - Role being assigned (owner/admin/member/viewer)
 */
export async function sendInvitationEmail({
  to,
  invitedBy,
  householdName,
  invitationUrl,
  role,
}: {
  to: string;
  invitedBy: string;
  householdName: string;
  role: string;
  invitationUrl: string;
}): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You've been invited to join a household</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #10b981;
            margin: 0;
            font-size: 24px;
          }
          .content {
            margin-bottom: 30px;
          }
          .info-box {
            background-color: #f3f4f6;
            border-left: 4px solid #10b981;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #10b981;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            text-align: center;
          }
          .button:hover {
            background-color: #059669;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
          }
          .link {
            color: #10b981;
            word-break: break-all;
          }
          .role-badge {
            display: inline-block;
            padding: 4px 12px;
            background-color: #dbeafe;
            color: #1e40af;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: capitalize;
            margin-left: 8px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You've Been Invited! 🎉</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p><strong>${invitedBy}</strong> has invited you to join the <strong>${householdName}</strong> household on Unified Ledger.</p>
            <div class="info-box">
              <strong>Household:</strong> ${householdName}<br>
              <strong>Role:</strong> <span class="role-badge">${role}</span><br>
              <strong>Invited by:</strong> ${invitedBy}
            </div>
            <p>Join this household to collaborate on finances, share budgets, and track expenses together.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${invitationUrl}" class="button">Accept Invitation</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${invitationUrl}" class="link">${invitationUrl}</a></p>
            <p><strong>This invitation link will expire in 30 days.</strong></p>
            <p>If you don't have a Unified Ledger account yet, you can create one when you accept the invitation.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The Unified Ledger Team</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Hi there,

${invitedBy} has invited you to join the ${householdName} household on Unified Ledger.

Household: ${householdName}
Role: ${role}
Invited by: ${invitedBy}

Join this household to collaborate on finances, share budgets, and track expenses together.

Accept your invitation here:
${invitationUrl}

This invitation link will expire in 30 days.

If you don't have a Unified Ledger account yet, you can create one when you accept the invitation.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
The Unified Ledger Team
  `.trim();

  await sendEmail({
    to,
    subject: `You've been invited to join ${householdName} on Unified Ledger`,
    html,
    text,
  });

  console.log('[Email] Invitation email sent to:', to);
}

/**
 * Send welcome email (optional, called after successful verification)
 *
 * @param to - User's verified email address
 * @param userName - User's display name
 */
export async function sendWelcomeEmail({
  to,
  userName,
}: {
  to: string;
  userName: string;
}): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Unified Ledger</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #10b981;
            margin: 0;
            font-size: 24px;
          }
          .content {
            margin-bottom: 30px;
          }
          .feature-box {
            background-color: #f3f4f6;
            border-radius: 6px;
            padding: 16px;
            margin: 12px 0;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #10b981;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            text-align: center;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Unified Ledger!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>Your email has been verified successfully! You now have full access to all Unified Ledger features.</p>
            <p><strong>Here's what you can do:</strong></p>
            <div class="feature-box">
              📊 Track transactions across multiple accounts
            </div>
            <div class="feature-box">
              💰 Set and monitor budgets in real-time
            </div>
            <div class="feature-box">
              📅 Manage bills with auto-detection and reminders
            </div>
            <div class="feature-box">
              🎯 Set savings goals and track your progress
            </div>
            <div class="feature-box">
              👥 Collaborate with household members
            </div>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" class="button">Go to Dashboard</a>
            </p>
            <p>If you have any questions or need help getting started, feel free to reach out to our support team.</p>
          </div>
          <div class="footer">
            <p>Happy budgeting!<br>The Unified Ledger Team</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Hi ${userName},

Welcome to Unified Ledger! Your email has been verified successfully.

Here's what you can do:
- Track transactions across multiple accounts
- Set and monitor budgets in real-time
- Manage bills with auto-detection and reminders
- Set savings goals and track your progress
- Collaborate with household members

Go to your dashboard: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard

If you have any questions or need help getting started, feel free to reach out to our support team.

Happy budgeting!
The Unified Ledger Team
  `.trim();

  await sendEmail({
    to,
    subject: 'Welcome to Unified Ledger! 🎉',
    html,
    text,
  });

  console.log('[Email] Welcome email sent to:', to);
}
