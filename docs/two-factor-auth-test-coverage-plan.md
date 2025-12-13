## Two-Factor Authentication (2FA) — Test Coverage Plan

### Goal
Add **dedicated automated test coverage** for the already-implemented 2FA system:
- API routes under `app/api/user/two-factor/*`
- Core logic utilities in `lib/auth/two-factor-utils.ts`

This is in service of the “Testing Backlog” entry in `docs/features.md`.

### Constraints / Standards
- **TypeScript**: keep strict typing; avoid `any` (use `unknown` + narrowing where necessary).
- **Existing patterns**: follow `__tests__/api/*` style (mock modules, call route handler exports).
- **No UI/theme work**: this task is test coverage; no UI changes expected.
- **Determinism**: mock randomness/time where needed (backup codes, timestamps, QR generation).

---

## Scope

### 1) Unit tests: `lib/auth/two-factor-utils.ts`
Add `__tests__/lib/auth/two-factor-utils.test.ts` covering:
- **`generateTwoFactorSecret(userEmail, appName)`**
  - Returns `{ secret, otpauthUrl }` non-empty strings
  - Includes user email and app name in the label (sanity check)
- **`verifyTwoFactorToken(token, secret)`**
  - Returns `false` for invalid input
  - Returns `true` for valid token generated from the same secret (using real `speakeasy`)
  - Returns `false` if `speakeasy` throws (mock throw branch)
- **`generateBackupCodes(count)`**
  - Returns exactly `count` codes
  - Codes are uppercase hex length 8
  - `hashedCodes` correspond to SHA-256 of the uppercase codes
  - Deterministic test path by mocking `crypto.randomBytes`
- **`verifyBackupCode(code, hashedCodes)`**
  - Case-insensitive verification (uppercased prior to hashing)
- **`removeBackupCode(code, hashedCodes)`**
  - Removes exactly one matching hash
  - Leaves array unchanged if code not present
- **`generateQRCode(otpauthUrl)`**
  - Returns data URL when QR generation succeeds (mock `qrcode.toDataURL`)
  - Throws `Failed to generate QR code` when QR generation fails

### 2) API route tests: `app/api/user/two-factor/*`
Add `__tests__/api/two-factor.test.ts` covering:

#### `GET /api/user/two-factor/status`
- **401** when `requireAuth()` throws `Unauthorized`
- **200** when user has 2FA disabled and no codes
  - `enabled=false`, `verifiedAt=null`, `backupCodesCount=0`, `isSetupComplete=false`
- **200** when user has 2FA enabled + verified date + valid backup code JSON array
  - `enabled=true`, `verifiedAt` is ISO string, `backupCodesCount` matches, `isSetupComplete=true`
- **200** when backup codes are invalid JSON
  - `backupCodesCount=0` (error branch)
- **500** when db throws

#### `POST /api/user/two-factor/enable`
- **401** when unauthenticated
- **400** when 2FA already enabled
- **200** when generating a new secret
  - Stores `twoFactorSecret` and updates `updatedAt`
  - Returns `secret`, `qrCode`, `otpauthUrl`
  - Mock QR code generation for determinism and speed

#### `POST /api/user/two-factor/verify`
- **401** when unauthenticated
- **400** when token missing/invalid type
- **400** when setup not started (no secret)
- **400** when already enabled
- **400** when invalid token
- **200** valid token → enables 2FA, writes backup codes, returns plaintext codes once
  - Mock `generateBackupCodes` to deterministic values
  - Mock `verifyTwoFactorToken` to control branches

#### `GET /api/user/two-factor/backup-codes`
- **401** when unauthenticated
- **400** when 2FA not enabled
- **200** returns new plaintext codes and invalidates old ones (writes new hashed codes)

#### `POST /api/user/two-factor/disable`
- **401** when unauthenticated
- **400** when token missing
- **400** when 2FA not enabled
- **400** when secret missing
- **400** invalid token/backup code
- **200** with valid TOTP token disables and clears secret/codes/verifiedAt
- **200** with valid backup code disables AND removes that backup code first (covers removal branch)

#### `GET /api/user/two-factor/verify-login?email=...`
- **400** missing email
- **404** unknown user
- **200** returns `required: true|false` based on `twoFactorEnabled`

#### `POST /api/user/two-factor/verify-login`
- **400** missing email/token
- **404** unknown user
- **400** 2FA not enabled
- **400** secret missing
- **400** invalid token
- **200** valid token returns `{ success: true, userId }`
- **Backup code path**: valid backup code removes one code from stored list

---

## Test Implementation Approach
- **Mocking**:
  - Mock `@/lib/auth-helpers` `requireAuth` for authenticated routes.
  - Mock `@/lib/db` to avoid touching sqlite (`db.select/update/insert` as chainable fakes).
  - For deterministic 2FA:
    - Mock `generateQRCode` (or `qrcode.toDataURL`) in enable tests.
    - Mock `generateBackupCodes` in verify/backup-codes tests.
    - Use real `speakeasy` only for `two-factor-utils` unit tests.
- **Requests**:
  - Use lightweight request objects (`{ json: async () => body } as Request`) for handlers that expect `request.json()`.
  - For handlers relying on `new URL(request.url)`, pass a real `Request` with a URL string.

---

## “First Task” to Implement Immediately
Create `__tests__/api/two-factor-status-enable.test.ts` with:
1. `GET /api/user/two-factor/status` coverage for:
   - 401 unauthorized
   - 200 default disabled state
   - 200 enabled + verified + backupCodesCount
2. `POST /api/user/two-factor/enable` coverage for:
   - 401 unauthorized
   - 400 already enabled
   - 200 success (secret stored + response shape)

Once those pass, continue with the remaining endpoints in the scope list.

---

## Docs Updates (after first tests land)
- Update `docs/features.md` “Testing Backlog” item name to **“Two-Factor Authentication (2FA) (Test Coverage)”**, and link this plan file.
- Add/adjust a short 2FA entry under `docs/manual-testing-checklist.md` → **Settings → Privacy & Security** for manual verification (enable/verify/backup codes/disable/login verification prompt).

