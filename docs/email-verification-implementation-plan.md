# Email Verification Implementation Plan

**Feature:** Email Verification Flow
**Status:** Not Started
**Priority:** High (Security Feature)
**Estimated Time:** 6-8 hours
**Date:** 2025-11-14

## Overview

Implement a complete email verification system to verify user email addresses during signup and when changing email. This is a foundational security feature that will enable future features like password reset, two-factor authentication, and trusted email communications.

## Current State Analysis

### What Exists
- ✅ Better Auth configured with email/password authentication
- ✅ `user` table with `emailVerified` boolean field (in auth-schema.ts)
- ✅ `verification` table for storing verification tokens
- ✅ ProfileTab UI shows email verification status (line 255-257)
- ✅ SMTP configuration placeholders in `.env.production.example`
- ✅ Notification service infrastructure (though not sending emails yet)
- ✅ Email update API endpoint at `/api/user/email`

### What's Missing
- ❌ Email sending package (nodemailer/resend/sendgrid)
- ❌ Email service utility for composing and sending emails
- ❌ Email verification enabled in Better Auth config (currently `requireEmailVerification: false`)
- ❌ Email templates (HTML + text fallback)
- ❌ UI for resending verification emails
- ❌ Verification link handler/callback
- ❌ Email verification requirement enforcement
- ❌ New email verification flow when changing email

## Architecture Decisions

### Email Service Provider
**Decision:** Use **Resend** as the email service provider

**Rationale:**
- Modern, developer-friendly API
- React Email integration for beautiful templates
- Generous free tier (100 emails/day, 3,000/month)
- Better deliverability than SMTP
- Simple setup with just API key
- Official Next.js support

**Alternative considered:** Nodemailer with SMTP
- More setup required
- Self-hosting concerns
- Lower deliverability
- Better for users who want full control

**Implementation:** Support both Resend (primary) and Nodemailer (fallback for self-hosting)

### Email Template System
**Decision:** Use **React Email** for templates

**Rationale:**
- Type-safe email templates with React components
- Preview templates in development
- Automatic HTML + text generation
- Consistent styling with application theme
- Reusable components for future emails

### Better Auth Integration
**Decision:** Use Better Auth's built-in email verification plugin

**Rationale:**
- Already handles token generation, storage, expiration
- Provides secure verification link generation
- Manages `emailVerified` field automatically
- Reduces custom code and potential security issues

## Implementation Plan

### Phase 1: Dependencies & Configuration (30 min)

#### 1.1 Install Required Packages
```bash
pnpm add resend react-email @react-email/components nodemailer
pnpm add -D @types/nodemailer
```

#### 1.2 Update Environment Variables
Create/update `.env.local` and `.env.production.example`:
```env
# Email Provider (resend or smtp)
EMAIL_PROVIDER=resend

# Resend Configuration (Primary)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=Unified Ledger

# SMTP Configuration (Fallback for self-hosting)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@your-domain.com
SMTP_FROM_NAME=Unified Ledger

# Better Auth Secret (Already exists, but document here)
BETTER_AUTH_SECRET=your-secret-key-min-32-chars

# Application URL (for verification links)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### 1.3 Update Better Auth Configuration
File: `lib/better-auth.ts`

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as authSchema from "@/auth-schema";
import { sendVerificationEmail } from "@/lib/email/email-service";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: authSchema,
  }),
  basePath: "/api/better-auth",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // ✅ ENABLE THIS
    sendVerificationEmail: async ({ user, url, token }) => {
      await sendVerificationEmail({
        to: user.email,
        userName: user.name,
        verificationUrl: url,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update every 24 hours
  },
  secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-for-development-only-change-in-production",
});

export type Session = typeof auth.$Infer.Session;
```

### Phase 2: Email Service Infrastructure (1.5 hours)

#### 2.1 Create Email Service Utility
File: `lib/email/email-service.ts`

**Purpose:** Centralized email sending with provider abstraction

**Key Features:**
- Support both Resend and Nodemailer
- Graceful fallback if email is not configured
- Error handling and logging
- HTML + text email support
- Rate limiting protection

**Functions:**
- `sendEmail(options)` - Core email sending function
- `sendVerificationEmail({ to, userName, verificationUrl })` - Verification email
- `sendEmailChangeVerification({ to, userName, verificationUrl, newEmail })` - Email change verification
- `sendWelcomeEmail({ to, userName })` - Welcome email after verification (optional)

**Structure:**
```typescript
interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

async function sendEmail(options: SendEmailOptions): Promise<void>
async function sendVerificationEmail(...)
async function sendEmailChangeVerification(...)
async function sendWelcomeEmail(...)
```

#### 2.2 Create Email Provider Implementations
File: `lib/email/providers/resend-provider.ts`

**Resend implementation** - Primary provider

File: `lib/email/providers/smtp-provider.ts`

**Nodemailer implementation** - Fallback for self-hosting

#### 2.3 Create Email Configuration
File: `lib/email/email-config.ts`

**Purpose:** Centralized email configuration management

**Exports:**
- `emailConfig` - Configuration object
- `isEmailConfigured()` - Check if email is set up
- `getEmailProvider()` - Get active provider

### Phase 3: Email Templates (1 hour)

#### 3.1 Setup React Email
File: `emails/` (new directory at root)

Create directory structure:
```
emails/
├── _components/
│   ├── layout.tsx        # Base email layout
│   ├── header.tsx        # Email header with logo
│   ├── footer.tsx        # Email footer
│   ├── button.tsx        # Styled button component
│   └── theme.ts          # Email styling constants
├── verification-email.tsx
├── email-change-verification.tsx
└── welcome-email.tsx
```

#### 3.2 Create Verification Email Template
File: `emails/verification-email.tsx`

**Content:**
- Friendly greeting with user's name
- Clear explanation of verification purpose
- Prominent verification button (uses theme primary color)
- Verification link as fallback (for email clients without button support)
- Expiration notice (24 hours)
- Security notice (ignore if didn't sign up)
- Footer with app name and support link

**Design:**
- Uses semantic color tokens mapped to email-safe hex colors
- Responsive design
- High contrast for accessibility
- Matches application branding

#### 3.3 Create Email Change Verification Template
File: `emails/email-change-verification.tsx`

**Content:**
- Greeting with user's name
- Explanation that email change was requested
- Shows old email → new email
- Verification button
- Security notice about reverting if not requested
- Link to account settings

#### 3.4 Create Welcome Email Template (Optional)
File: `emails/welcome-email.tsx`

**Content:**
- Welcome message after verification
- Quick start guide links
- Feature highlights
- Support information

#### 3.5 Setup Email Preview
File: `package.json` - Add script:
```json
"scripts": {
  "email:dev": "email dev --port 3001"
}
```

### Phase 4: API Endpoints (1.5 hours)

#### 4.1 Create Resend Verification Email Endpoint
File: `app/api/user/resend-verification/route.ts`

**Method:** POST
**Auth:** Required
**Purpose:** Allow users to resend verification email

**Flow:**
1. Authenticate user
2. Check if email already verified → return error
3. Check rate limiting (max 3 requests per hour per user)
4. Generate new verification token using Better Auth
5. Send verification email
6. Return success

**Response:**
```typescript
{ success: true, message: "Verification email sent" }
// OR
{ error: "Email already verified" | "Too many requests" | "Failed to send email" }
```

#### 4.2 Update Email Change Endpoint
File: `app/api/user/email/route.ts` (modify existing)

**Current behavior:** Immediately changes email
**New behavior:** Send verification to new email, change only after verification

**Flow:**
1. Validate new email and password
2. Generate verification token for new email
3. Store pending email change in database (new field or verification metadata)
4. Send verification email to NEW email address
5. Return pending status
6. On verification → complete email change, set emailVerified=true

#### 4.3 Create Email Verification Callback Handler
File: `app/api/auth/verify-email/route.ts`

**Method:** GET
**Purpose:** Handle verification link clicks

**Flow:**
1. Extract token from query params
2. Verify token with Better Auth
3. If valid:
   - Set emailVerified=true
   - Complete any pending email changes
   - Optional: Send welcome email
   - Redirect to dashboard with success message
4. If invalid/expired:
   - Redirect to error page with resend option

**Better Auth Integration:**
Better Auth handles this automatically at `/api/better-auth/verify-email` - we just need to configure it.

### Phase 5: UI Updates (1.5 hours)

#### 5.1 Update Profile Tab - Verification Status Banner
File: `components/settings/profile-tab.tsx`

**Add after avatar section (around line 188):**

```tsx
{/* Email Verification Banner */}
{profile && !profile.emailVerified && (
  <div className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-4">
    <div className="flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-[var(--color-warning)] mt-0.5" />
      <div className="flex-1">
        <h3 className="font-semibold text-foreground mb-1">
          Verify your email address
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          Please verify your email to access all features and ensure account security.
          Check your inbox for the verification email.
        </p>
        <Button
          onClick={handleResendVerification}
          disabled={resendingVerification}
          size="sm"
          variant="outline"
          className="border-[var(--color-warning)] text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10"
        >
          {resendingVerification && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Resend Verification Email
        </Button>
      </div>
    </div>
  </div>
)}
```

**Add state and handler:**
```typescript
const [resendingVerification, setResendingVerification] = useState(false);

const handleResendVerification = async () => {
  setResendingVerification(true);
  try {
    const response = await fetch('/api/user/resend-verification', {
      method: 'POST',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to send verification email');
    }

    toast.success('Verification email sent! Check your inbox.');
  } catch (error) {
    console.error('Error resending verification:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to send email');
  } finally {
    setResendingVerification(false);
  }
};
```

#### 5.2 Update Email Section
File: `components/settings/profile-tab.tsx` (lines 249-301)

**Changes:**
- Add notice that changing email requires verification
- Update success message to indicate verification email sent
- Add helper text about checking new email for verification

#### 5.3 Create Email Verification Success Page (Optional)
File: `app/email-verified/page.tsx`

**Purpose:** Landing page after clicking verification link

**Content:**
- Success message
- Checkmark icon
- "Continue to Dashboard" button
- Auto-redirect after 5 seconds

### Phase 6: Verification Enforcement (1 hour)

#### 6.1 Create Verification Guard Utility
File: `lib/auth/verification-guard.ts`

**Purpose:** Middleware helper to require email verification

```typescript
export async function requireEmailVerification() {
  const user = await requireAuth();

  if (!user.emailVerified) {
    throw new Error('Email verification required');
  }

  return user;
}
```

#### 6.2 Apply to Sensitive Operations
**Endpoints that should require verification:**
- Creating household invitations
- Changing sensitive settings
- Exporting data
- Deleting account
- Any payment/billing operations (future)

**Implementation:**
Replace `requireAuth()` with `requireEmailVerification()` in these endpoints.

#### 6.3 Add Frontend Verification Checks
File: `components/guards/verification-required.tsx`

**Component wrapper:**
```tsx
<VerificationRequired>
  <SensitiveFeature />
</VerificationRequired>
```

Shows verification banner if not verified, otherwise renders children.

### Phase 7: Testing & Polish (1.5 hours)

#### 7.1 Manual Testing Checklist
- [ ] New user signup sends verification email
- [ ] Verification link verifies email correctly
- [ ] Expired verification link shows error
- [ ] Resend verification email works (with rate limiting)
- [ ] Changing email sends verification to new email
- [ ] New email is verified before change completes
- [ ] Verified users don't see verification banners
- [ ] Unverified users see verification warnings
- [ ] Email templates render correctly in Gmail, Outlook, Apple Mail
- [ ] Text fallback works when HTML is disabled
- [ ] Verification required endpoints block unverified users
- [ ] Rate limiting prevents spam (3 emails per hour)

#### 7.2 Error Handling
- [ ] Graceful handling if email service is down
- [ ] Clear error messages for users
- [ ] Logging for debugging
- [ ] Fallback behavior if email not configured

#### 7.3 Documentation Updates
- [ ] Update `.env.production.example` with email variables
- [ ] Add email configuration section to README or docs
- [ ] Document email provider setup (Resend API key)
- [ ] Add troubleshooting guide

#### 7.4 Database Migration
No migration needed - `emailVerified` field already exists in auth-schema.

However, consider adding:
- Rate limiting table for resend operations
- Pending email changes table (if not using verification metadata)

### Phase 8: Future Enhancements (Not in scope for this PR)

- [ ] Email verification reminder notifications
- [ ] Admin panel to manually verify users
- [ ] Verification analytics (open rates, click rates)
- [ ] Custom verification email templates per household
- [ ] SMS verification as alternative
- [ ] Social proof ("Join 10,000+ verified users")
- [ ] Verification badge in UI
- [ ] Re-verification after 1 year of inactivity

## File Structure Summary

### New Files
```
lib/
├── email/
│   ├── email-service.ts           # Core email service
│   ├── email-config.ts            # Email configuration
│   └── providers/
│       ├── resend-provider.ts     # Resend implementation
│       └── smtp-provider.ts       # Nodemailer implementation
├── auth/
│   └── verification-guard.ts      # Email verification middleware

emails/                             # React Email templates
├── _components/
│   ├── layout.tsx
│   ├── header.tsx
│   ├── footer.tsx
│   ├── button.tsx
│   └── theme.ts
├── verification-email.tsx
├── email-change-verification.tsx
└── welcome-email.tsx

app/
├── api/
│   └── user/
│       └── resend-verification/
│           └── route.ts            # Resend verification email
└── email-verified/
    └── page.tsx                    # Verification success page

components/
└── guards/
    └── verification-required.tsx   # Verification guard component
```

### Modified Files
```
lib/better-auth.ts                 # Enable email verification
components/settings/profile-tab.tsx # Add verification UI
app/api/user/email/route.ts        # Update email change flow
.env.production.example            # Add email variables
package.json                       # Add email packages
```

## Integration with Existing Features

### Theme System
Email templates will use theme-aware colors:
- Primary color for buttons
- Background colors for layout
- Text colors for content
- Warning color for security notices

Map CSS variables to hex colors in `emails/_components/theme.ts`

### Notification System
Email verification can integrate with existing notification system:
- Create in-app notification after verification
- Weekly reminder notifications for unverified users
- Household activity log entry when email verified

### Settings Page
Verification status already displayed in Profile tab. This plan enhances it with:
- Action button to resend verification
- Warning banner for unverified accounts
- Email change flow with verification

## Security Considerations

1. **Token Security**
   - Better Auth handles secure token generation
   - Tokens expire after 24 hours
   - One-time use tokens

2. **Rate Limiting**
   - Max 3 verification emails per hour per user
   - Prevents email bombing attacks

3. **Email Privacy**
   - Never expose full email in URLs or client-side code
   - Use token identifiers only

4. **Verification Enforcement**
   - Critical operations require verification
   - Graceful degradation for non-critical features

5. **Email Provider Security**
   - API keys stored in environment variables
   - Never commit credentials to git
   - Use different keys for dev/staging/production

## Performance Considerations

1. **Async Email Sending**
   - Don't block user flow waiting for email
   - Return success immediately after queuing
   - Log failures for monitoring

2. **Email Queue**
   - Consider queue system for high volume (future)
   - Retry failed sends with exponential backoff

3. **Template Rendering**
   - Pre-compile email templates in production
   - Cache rendered templates when possible

## Success Criteria

- ✅ New users receive verification email on signup
- ✅ Verification links work correctly
- ✅ Unverified users see clear verification prompts
- ✅ Email changes require verification of new email
- ✅ Sensitive operations require verified email
- ✅ Rate limiting prevents abuse
- ✅ Email templates look professional across email clients
- ✅ Error handling is robust and user-friendly
- ✅ Zero breaking changes to existing functionality
- ✅ Documentation is complete and clear

## Rollout Plan

### Phase 1: Soft Launch
- Deploy with `requireEmailVerification: false` (current state)
- Email infrastructure ready but optional
- Users can manually request verification

### Phase 2: Gradual Enforcement
- Enable verification for new signups only
- Existing users continue without verification
- Add gentle prompts for existing users to verify

### Phase 3: Full Enforcement
- Enable `requireEmailVerification: true`
- All users must verify email
- Send bulk "please verify" emails to existing users
- Grace period before blocking unverified accounts

### This Implementation
We'll implement **Phase 1** (Soft Launch), making it easy to enable Phases 2-3 later with configuration changes.

## Estimated Timeline

- Phase 1: Dependencies & Configuration - 30 min
- Phase 2: Email Service Infrastructure - 1.5 hours
- Phase 3: Email Templates - 1 hour
- Phase 4: API Endpoints - 1.5 hours
- Phase 5: UI Updates - 1.5 hours
- Phase 6: Verification Enforcement - 1 hour
- Phase 7: Testing & Polish - 1.5 hours

**Total: 8.5 hours**

## Next Steps

1. Review and approve this plan
2. Start with Phase 1: Install dependencies and configure environment
3. Implement phases sequentially
4. Test thoroughly after each phase
5. Deploy to staging for user testing
6. Document setup process for self-hosters
7. Deploy to production with soft launch approach

---

**Ready to begin implementation!**
