# Two-Factor Authentication Testing Guide

## Overview

This guide covers how to test the 2FA implementation in Unified Ledger.

## Prerequisites

1. Database migration applied (`0048_add_two_factor_auth.sql`)
2. Dependencies installed (`speakeasy`, `qrcode`, `qrcode.react`)
3. Development server running (`pnpm dev`)

## Testing Steps

### 1. Enable 2FA

1. **Navigate to Settings**
   - Go to `/dashboard/settings?section=user&tab=privacy`
   - Scroll to "Two-Factor Authentication" section

2. **Start 2FA Setup**
   - Click "Enable 2FA" button
   - A modal should appear with:
     - QR code for scanning
     - Secret key for manual entry
     - Instructions

3. **Scan QR Code**
   - Open your authenticator app (Google Authenticator, Authy, etc.)
   - Scan the QR code displayed in the modal
   - Or manually enter the secret key

4. **Verify Setup**
   - Enter the 6-digit code from your authenticator app
   - Click "Verify & Enable"
   - Backup codes should be displayed
   - **Important:** Save backup codes immediately (copy or download)

### 2. Test Login with 2FA

1. **Sign Out**
   - Sign out of your account

2. **Sign In**
   - Go to `/sign-in`
   - Enter your email and password
   - Click "Sign In"

3. **2FA Verification**
   - After password verification, you should see:
     - Shield icon
     - "Two-Factor Authentication" heading
     - Input field for 6-digit code
   - Enter code from authenticator app
   - Click "Verify"

4. **Successful Login**
   - After verification, you should be redirected to dashboard
   - Session should be created successfully

### 3. Test Backup Codes

1. **Use Backup Code**
   - Sign out
   - Sign in with email/password
   - When prompted for 2FA, enter a backup code instead
   - Should accept backup code and complete login

2. **Verify Backup Code Removed**
   - After using a backup code, it should be removed from your account
   - Check status in settings - backup code count should decrease

### 4. Test Disable 2FA

1. **Navigate to Settings**
   - Go to Privacy & Security tab
   - Find "Two-Factor Authentication" section

2. **Disable 2FA**
   - Click "Disable" button
   - Enter 6-digit verification code
   - Confirm disable

3. **Verify Disabled**
   - Status should show "Disabled"
   - Login should no longer require 2FA code

### 5. Test Generate New Backup Codes

1. **Navigate to Settings**
   - Go to Privacy & Security tab
   - Find "Two-Factor Authentication" section

2. **Generate New Codes**
   - Click "Generate Codes" button (if backup codes are low/empty)
   - New codes should be displayed
   - **Important:** Old codes are invalidated when new ones are generated

## API Endpoint Testing

### Test Status Endpoint

```bash
curl -X GET http://localhost:3000/api/user/two-factor/status \
  -H "Cookie: better-auth.session_data=..."
```

Expected response:
```json
{
  "enabled": true,
  "verifiedAt": "2025-01-XX...",
  "backupCodesCount": 8,
  "isSetupComplete": true
}
```

### Test Enable Endpoint

```bash
curl -X POST http://localhost:3000/api/user/two-factor/enable \
  -H "Cookie: better-auth.session_data=..." \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "secret": "GRLXOXR4KRBTARZPENJG...",
  "qrCode": "data:image/png;base64,...",
  "otpauthUrl": "otpauth://totp/..."
}
```

### Test Verify Endpoint

```bash
curl -X POST http://localhost:3000/api/user/two-factor/verify \
  -H "Cookie: better-auth.session_data=..." \
  -H "Content-Type: application/json" \
  -d '{"token": "123456"}'
```

Expected response:
```json
{
  "success": true,
  "backupCodes": ["ABC123", "DEF456", ...],
  "message": "Two-factor authentication enabled successfully"
}
```

## Common Issues

### Issue: QR Code Not Displaying

**Solution:**
- Check browser console for errors
- Verify `qrcode.react` is installed
- Check network tab for API errors

### Issue: Invalid Verification Code

**Possible Causes:**
- Clock sync issue (authenticator app time must match server time)
- Code expired (codes are valid for 30 seconds)
- Wrong secret key entered

**Solution:**
- Ensure device time is synchronized
- Generate new code from authenticator app
- Re-scan QR code if needed

### Issue: Backup Codes Not Working

**Possible Causes:**
- Code already used (one-time use only)
- Code entered incorrectly
- Codes regenerated (old codes invalidated)

**Solution:**
- Use a different backup code
- Check for typos
- Generate new backup codes if needed

### Issue: Login Flow Not Prompting for 2FA

**Possible Causes:**
- 2FA not properly enabled
- Session already exists
- API endpoint error

**Solution:**
- Verify 2FA status in settings
- Clear browser cookies and try again
- Check server logs for errors

## Security Considerations

1. **Backup Codes**
   - Store backup codes securely (password manager, encrypted file)
   - Never share backup codes
   - Regenerate if compromised

2. **Authenticator App**
   - Use a reputable authenticator app
   - Enable app lock/password protection
   - Keep app updated

3. **Device Security**
   - Keep device OS updated
   - Use device lock screen
   - Don't share device with untrusted users

## Manual Testing Checklist

- [ ] Enable 2FA successfully
- [ ] QR code displays correctly
- [ ] Manual secret entry works
- [ ] Verification code accepted
- [ ] Backup codes displayed and saved
- [ ] Login requires 2FA code
- [ ] Backup code works for login
- [ ] Used backup code is removed
- [ ] Generate new backup codes works
- [ ] Old backup codes invalidated
- [ ] Disable 2FA works
- [ ] Login no longer requires 2FA after disable
- [ ] Status endpoint returns correct data
- [ ] Error handling works (invalid codes, etc.)

## Automated Testing

Run the utility test script:

```bash
node scripts/test-2fa-utils.mjs
```

This tests:
- TOTP secret generation
- TOTP token generation
- TOTP token verification
- Backup code generation
- Backup code verification
- Backup code removal
- Invalid token rejection

All tests should pass ✅

