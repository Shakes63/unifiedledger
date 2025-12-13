# Email Flows – Implementation Plan

## Goal
Add **automated coverage** for the core email flows that are currently marked as incomplete:
- verification resend rate limiting
- email-change verification callback behavior
- error handling + provider fallback behavior (Resend → SMTP)

## Plan

### 1) API route tests (first task)
- `POST /api/user/resend-verification`
  - 401 when unauthorized
  - 400 when email already verified / missing user email
  - rate limiting: max 3 per hour
  - success triggers email send

- `GET /api/auth/verify-email-change`
  - validates token + redirects to success/failure
  - consumes token (cannot reuse)

- `POST /api/user/cancel-email-change`
  - clears pending email change

### 2) Email service unit tests
- `lib/email/email-config.ts` chooses provider correctly
- `lib/email/email-service.ts` falls back to SMTP when Resend fails

## Test Plan
- `pnpm test __tests__/api/email-*.test.ts __tests__/lib/email/*.test.ts`
