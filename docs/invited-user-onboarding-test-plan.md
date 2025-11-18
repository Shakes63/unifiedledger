# Invited User Onboarding - Test Plan

## Overview
This test plan covers all aspects of the Invited User Onboarding feature, including invitation detection, demo data creation, and the complete onboarding flow.

**Status:** Testing In Progress  
**Date:** 2025-01-16

---

## Test Scenarios

### Test 1: Sign-Up with Invitation Token (URL Parameter)
**Objective:** Verify that users can sign up with an invitation token in the URL and are automatically redirected to onboarding with demo mode.

**Steps:**
1. Get a valid invitation token from an existing household
2. Navigate to `/sign-up?invitation_token=[token]`
3. Fill out sign-up form
4. Submit form
5. Verify invitation is accepted automatically
6. Verify redirect to `/dashboard?onboarding=true&invited=true`
7. Verify onboarding modal opens
8. Verify demo mode is activated

**Expected Results:**
- ✅ Sign-up succeeds
- ✅ Invitation accepted automatically
- ✅ Redirect includes invitation flags
- ✅ Onboarding modal opens
- ✅ Demo mode is active

---

### Test 2: Sign-Up with Invitation Token (localStorage)
**Objective:** Verify that invitation tokens stored in localStorage are detected during sign-up.

**Steps:**
1. Store invitation token in localStorage: `unified-ledger:invitation-token`
2. Store household ID in localStorage: `unified-ledger:invitation-household-id`
3. Navigate to `/sign-up` (without URL parameter)
4. Fill out sign-up form
5. Submit form
6. Verify invitation is accepted automatically
7. Verify redirect to onboarding with invitation flags

**Expected Results:**
- ✅ Token detected from localStorage
- ✅ Invitation accepted automatically
- ✅ Redirect includes invitation flags

---

### Test 3: Invitation Page - New User Flow
**Objective:** Verify that new users (not completed onboarding) are redirected to onboarding with demo mode.

**Steps:**
1. Create a new user account (or use one that hasn't completed onboarding)
2. Get a valid invitation token
3. Navigate to `/invite/[token]`
4. Verify user is signed in
5. Click "Accept Invitation"
6. Verify invitation is accepted
7. Verify redirect to `/dashboard?onboarding=true&invited=true`
8. Verify onboarding modal opens with demo mode

**Expected Results:**
- ✅ Invitation accepted successfully
- ✅ Redirect includes invitation flags
- ✅ Onboarding modal opens
- ✅ Demo mode is active

---

### Test 4: Invitation Page - Existing User Flow
**Objective:** Verify that existing users (completed onboarding) are redirected to dashboard without onboarding.

**Steps:**
1. Use an existing user account (completed onboarding)
2. Get a valid invitation token
3. Navigate to `/invite/[token]`
4. Verify user is signed in
5. Click "Accept Invitation"
6. Verify invitation is accepted
7. Verify redirect to `/dashboard` (no onboarding flags)
8. Verify onboarding modal does NOT open
9. Verify household is switched automatically

**Expected Results:**
- ✅ Invitation accepted successfully
- ✅ Redirect to dashboard without onboarding flags
- ✅ Onboarding modal does NOT open
- ✅ Household switched automatically

---

### Test 5: Invitation Page - Not Signed In Flow
**Objective:** Verify that unsigned-in users are redirected to sign-in with invitation token preserved.

**Steps:**
1. Sign out (or use incognito window)
2. Get a valid invitation token
3. Navigate to `/invite/[token]`
4. Click "Sign in and Accept"
5. Verify redirect to sign-in page with invitation token
6. Sign in
7. Verify invitation is accepted automatically after sign-in
8. Verify redirect to onboarding with invitation flags

**Expected Results:**
- ✅ Token stored in localStorage before redirect
- ✅ Redirect includes invitation token
- ✅ After sign-in, invitation accepted automatically
- ✅ Redirect to onboarding with invitation flags

---

### Test 6: Welcome Step - Invitation-Specific Content
**Objective:** Verify that welcome step shows invitation-specific content when in demo mode.

**Steps:**
1. Start onboarding flow with invitation context
2. Verify welcome step shows:
   - Title: "Welcome to [Household Name]!"
   - Demo mode banner displayed
   - Invitation-specific description
   - Demo data list instead of regular setup list

**Expected Results:**
- ✅ Household name displayed in title
- ✅ Demo mode banner visible
- ✅ Invitation-specific description shown
- ✅ Demo data list displayed

---

### Test 7: Demo Data Creation Step
**Objective:** Verify that demo data is created successfully when in demo mode.

**Steps:**
1. Start onboarding flow with invitation context
2. Advance to step 2 (demo data creation)
3. Verify loading state shows "Creating accounts..."
4. Wait for completion
5. Verify success message shows counts:
   - 3 accounts
   - 5 categories
   - 6 merchants
   - 3 bills
   - 2 goals
   - 1 debt
   - 14 transactions
6. Verify auto-advance to next step
7. Verify demo data exists in database (all prefixed with "Demo")

**Expected Results:**
- ✅ Loading state displayed
- ✅ Demo data created successfully
- ✅ Correct counts displayed
- ✅ Auto-advance works
- ✅ All data prefixed with "Demo"
- ✅ Data associated with correct household

---

### Test 8: Step Skipping in Demo Mode
**Objective:** Verify that all creation steps skip automatically in demo mode.

**Steps:**
1. Start onboarding flow with invitation context
2. Complete demo data creation step
3. Verify household step shows skip message and auto-advances
4. Verify account step shows skip message and auto-advances
5. Verify bill step shows skip message and auto-advances
6. Verify goal step shows skip message and auto-advances
7. Verify debt step shows skip message and auto-advances
8. Verify transaction step shows skip message and auto-advances

**Expected Results:**
- ✅ All steps show skip messages
- ✅ All steps auto-advance after 1.5 seconds
- ✅ Skip messages are informative
- ✅ No forms displayed in demo mode

---

### Test 9: Complete Step - Invitation-Specific Content
**Objective:** Verify that complete step shows invitation-specific content.

**Steps:**
1. Complete onboarding flow with invitation context
2. Verify complete step shows:
   - Title: "Demo Data Created!"
   - Invitation-specific description
   - Tips for exploring (not regular pro tips)
   - Button text: "Start Exploring"
3. Click "Start Exploring"
4. Verify invitation context is cleared
5. Verify redirect to dashboard

**Expected Results:**
- ✅ Invitation-specific title displayed
- ✅ Invitation-specific description shown
- ✅ Tips for exploring displayed
- ✅ Button text is "Start Exploring"
- ✅ Invitation context cleared after completion
- ✅ Redirect to dashboard works

---

### Test 10: Invitation Context Initialization
**Objective:** Verify that invitation context is initialized correctly from URL parameters and localStorage.

**Steps:**
1. Store invitation token and household ID in localStorage
2. Navigate to `/dashboard?onboarding=true&invited=true`
3. Verify onboarding modal opens
4. Verify invitation context is initialized:
   - `isInvitedUser` is true
   - `invitationHouseholdId` is set
   - `isDemoMode` is true
   - `invitationToken` is set

**Expected Results:**
- ✅ Onboarding modal opens
- ✅ All invitation context values set correctly
- ✅ Demo mode activated

---

### Test 11: Error Handling - Invalid Invitation Token
**Objective:** Verify graceful handling of invalid invitation tokens.

**Steps:**
1. Navigate to `/sign-up?invitation_token=invalid_token`
2. Fill out sign-up form
3. Submit form
4. Verify sign-up succeeds
5. Verify error message shown about invitation acceptance failure
6. Verify user can still proceed with normal onboarding

**Expected Results:**
- ✅ Sign-up succeeds
- ✅ Error message displayed
- ✅ User can continue with normal flow

---

### Test 12: Error Handling - Expired Invitation Token
**Objective:** Verify graceful handling of expired invitation tokens.

**Steps:**
1. Get an expired invitation token
2. Navigate to `/invite/[expired_token]`
3. Verify error message displayed
4. Verify user cannot accept expired invitation

**Expected Results:**
- ✅ Error message displayed
- ✅ Invitation cannot be accepted
- ✅ User-friendly error message

---

### Test 13: Error Handling - Demo Data Creation Failure
**Objective:** Verify graceful handling of demo data creation failures.

**Steps:**
1. Start onboarding flow with invitation context
2. Simulate API failure (network error or server error)
3. Verify error message displayed
4. Verify user can still continue with onboarding
5. Verify auto-advance still works

**Expected Results:**
- ✅ Error message displayed
- ✅ User can continue
- ✅ Auto-advance works even on error

---

### Test 14: Invitation Context Persistence
**Objective:** Verify that invitation context persists across page refreshes.

**Steps:**
1. Start onboarding flow with invitation context
2. Refresh page during onboarding
3. Verify invitation context is restored from localStorage
4. Verify demo mode is still active
5. Verify onboarding continues from correct step

**Expected Results:**
- ✅ Context restored from localStorage
- ✅ Demo mode still active
- ✅ Onboarding continues correctly

---

### Test 15: Multiple Invitation Tokens Handling
**Objective:** Verify handling of multiple invitation tokens in localStorage.

**Steps:**
1. Store multiple invitation tokens in localStorage
2. Start onboarding flow
3. Verify only the most recent token is used
4. Verify other tokens don't interfere

**Expected Results:**
- ✅ Most recent token used
- ✅ No interference from other tokens
- ✅ Flow works correctly

---

## Test Execution Checklist

- [ ] Test 1: Sign-Up with Invitation Token (URL Parameter)
- [ ] Test 2: Sign-Up with Invitation Token (localStorage)
- [ ] Test 3: Invitation Page - New User Flow
- [ ] Test 4: Invitation Page - Existing User Flow
- [ ] Test 5: Invitation Page - Not Signed In Flow
- [ ] Test 6: Welcome Step - Invitation-Specific Content
- [ ] Test 7: Demo Data Creation Step
- [ ] Test 8: Step Skipping in Demo Mode
- [ ] Test 9: Complete Step - Invitation-Specific Content
- [ ] Test 10: Invitation Context Initialization
- [ ] Test 11: Error Handling - Invalid Invitation Token
- [ ] Test 12: Error Handling - Expired Invitation Token
- [ ] Test 13: Error Handling - Demo Data Creation Failure
- [ ] Test 14: Invitation Context Persistence
- [ ] Test 15: Multiple Invitation Tokens Handling

---

## Manual Testing Notes

### Prerequisites
1. Development server running (`pnpm dev`)
2. Database accessible
3. At least one household exists
4. Ability to create invitations

### Test Data Setup
1. Create a test household
2. Create an invitation for a test email
3. Note the invitation token
4. Use test email for sign-up tests

### Common Issues to Watch For
- Invitation tokens not being detected
- Demo mode not activating
- Steps not skipping correctly
- Demo data not being created
- Invitation context not persisting
- Error messages not user-friendly

---

## Automated Testing (Future)
Consider adding automated tests for:
- Invitation token detection logic
- Demo data generation
- Step skipping logic
- Context initialization
- Error handling

