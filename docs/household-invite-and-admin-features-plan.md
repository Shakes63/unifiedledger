# Household Invite & Admin Features Implementation Plan

## Overview
This plan covers three related features for household management and user administration:
1. **Complete Invite Flow with Email** - Send invitation emails when users are invited to households
2. **Admin User Creation** - Allow application owner to create users with email/password and assign them to households
3. **Invited User Onboarding** - Special onboarding flow for invited users that creates demo data instead of real data

**Status:** Planning Complete - Ready for Implementation  
**Estimated Time:** 2-3 days  
**Last Updated:** 2025-01-16

---

## Feature 1: Complete Invite Flow with Email

### Current State
- ✅ Invitation API endpoint exists (`/api/households/[householdId]/invitations`)
- ✅ Invitation acceptance endpoint exists (`/api/invitations/accept`)
- ✅ Invitation page exists (`/app/invite/[token]/page.tsx`)
- ✅ Database schema for `householdInvitations` table
- ❌ **Missing:** Email sending when invitation is created
- ❌ **Missing:** Email template for invitations

### Implementation Steps

#### Step 1.1: Create Invitation Email Template
**File:** `lib/email/templates/invitation-email.ts`

- Create email template function `sendInvitationEmail()`
- Parameters: `{ to, invitedBy, householdName, invitationUrl, role }`
- Use existing email service pattern (similar to `sendVerificationEmail`)
- Include:
  - Household name
  - Inviter's name
  - Role being assigned
  - Invitation link (`/invite/[token]`)
  - Expiration date (30 days)
  - Clear call-to-action button
- Use semantic HTML email template with inline styles
- Follow existing email template patterns from `lib/email/email-service.ts`

#### Step 1.2: Update Invitation API to Send Email
**File:** `app/api/households/[householdId]/invitations/route.ts`

- After creating invitation record (line 108-117), add email sending logic
- Fetch household name from database
- Fetch inviter's name from Better Auth user table
- Generate invitation URL: `${baseUrl}/invite/${invitationToken}`
- Call `sendInvitationEmail()` with all required parameters
- Handle email sending errors gracefully (log but don't fail invitation creation)
- Add try-catch around email sending to prevent API failure if email service is down

#### Step 1.3: Add Email Service Export
**File:** `lib/email/email-service.ts`

- Export `sendInvitationEmail` function
- Follow existing pattern for other email functions
- Ensure it uses `sendEmail()` helper internally

#### Step 1.4: Update Invitation Page for Better UX
**File:** `app/invite/[token]/page.tsx`

- Add API endpoint to fetch invitation details (GET `/api/invitations/[token]`)
- Display household name and inviter name on invitation page
- Show invitation status (pending, expired, already accepted)
- Improve error handling and loading states
- Use semantic theme variables for styling

#### Step 1.5: Create Invitation Details API Endpoint
**File:** `app/api/invitations/[token]/route.ts` (new file)

- GET endpoint to fetch invitation details by token
- Return: `{ householdId, householdName, invitedBy, invitedByName, role, expiresAt, status }`
- Validate token and check expiration
- Don't require authentication (public endpoint for invitation links)

---

## Feature 2: Admin User Creation

### Current State
- ✅ Admin tab exists (`components/settings/admin-tab.tsx`)
- ✅ Owner check functionality exists (`lib/auth/owner-helpers.ts`)
- ✅ Better Auth user creation API available
- ❌ **Missing:** UI for creating users
- ❌ **Missing:** API endpoint for admin user creation
- ❌ **Missing:** Household assignment during user creation

### Implementation Steps

#### Step 2.1: Create Admin User Creation API Endpoint
**File:** `app/api/admin/users/route.ts` (new file)

- POST endpoint: Create user with email/password
- Request body: `{ email, password, name, householdId, role }`
- Validate owner status using `getCurrentUserOwnerStatus()`
- Validate email format and password strength (min 8 chars)
- Check if email already exists in Better Auth
- Create user using Better Auth API (`auth.api.signUpEmail`)
- If `householdId` provided:
  - Add user to household as member with specified role
  - Create `householdMembers` record
- Return: `{ id, email, name, householdId, role }`
- Handle errors gracefully (duplicate email, invalid household, etc.)

#### Step 2.2: Create Admin User List API Endpoint
**File:** `app/api/admin/users/route.ts` (same file, GET method)

- GET endpoint: List all users in the system
- Query params: `limit`, `offset`, `search` (optional email/name search)
- Return: `{ users: [...], total: number, limit: number, offset: number }`
- Include: `id, email, name, createdAt, householdCount`
- Only accessible to application owner
- Use pagination for large user lists

#### Step 2.3: Create Admin User Management UI Component
**File:** `components/settings/admin-users-tab.tsx` (new file)

- User list table with:
  - Email, Name, Created Date, Household Count
  - Actions: View Details, Edit, Delete (with confirmation)
- Create user form (dialog):
  - Email input (required)
  - Password input (required, show strength indicator)
  - Name input (optional)
  - Household selector (optional, shows all households)
  - Role selector (owner/admin/member/viewer, only if household selected)
  - Submit button with loading state
- Search/filter functionality
- Pagination controls
- Use semantic theme variables throughout
- Follow existing UI patterns from `admin-tab.tsx`

#### Step 2.4: Add User Management Section to Admin Tab
**File:** `components/settings/admin-tab.tsx`

- Add new section: "User Management"
- Import and render `AdminUsersTab` component
- Add tab or accordion structure if needed
- Use Card component for section container
- Add icon (Users icon from lucide-react)

#### Step 2.5: Create Admin User Update API Endpoint
**File:** `app/api/admin/users/[userId]/route.ts` (new file)

- PUT endpoint: Update user details
- Request body: `{ name?, email?, householdId?, role? }`
- Validate owner status
- Handle email changes (may require Better Auth API)
- Handle household assignment changes
- Return updated user object

#### Step 2.6: Create Admin User Delete API Endpoint
**File:** `app/api/admin/users/[userId]/route.ts` (same file, DELETE method)

- DELETE endpoint: Delete user account
- Validate owner status
- Prevent deleting the owner account
- Handle cascade deletion (household memberships, etc.)
- Use Better Auth API to delete user
- Return success message

---

## Feature 3: Invited User Onboarding

### Current State
- ✅ Onboarding flow exists (`components/onboarding/onboarding-modal.tsx`)
- ✅ Onboarding context exists (`contexts/onboarding-context.tsx`)
- ✅ Multiple onboarding steps exist (household, account, bill, goal, debt, transaction)
- ❌ **Missing:** Detection of invited users
- ❌ **Missing:** Demo data generation for invited users
- ❌ **Missing:** Special onboarding flow that creates demo data

### Implementation Steps

#### Step 3.1: Add Invitation Context to Onboarding
**File:** `contexts/onboarding-context.tsx`

- Add state: `isInvitedUser: boolean`
- Add state: `invitationHouseholdId: string | null`
- Add state: `isDemoMode: boolean` (for demo data creation)
- Update context to track invitation status
- Add method: `setInvitationContext(householdId: string)`

#### Step 3.2: Detect Invited User on Sign-Up
**File:** `app/sign-up/[[...index]]/page.tsx`

- After successful sign-up, check for invitation token in URL params or localStorage
- If invitation token exists:
  - Accept invitation automatically (call `/api/invitations/accept`)
  - Set invitation context in onboarding
  - Mark onboarding as "demo mode"
- Redirect to onboarding with invitation context

#### Step 3.3: Create Demo Data Generation Utility
**File:** `lib/onboarding/demo-data-generator.ts` (new file)

- Function: `generateDemoData(householdId: string, userId: string)`
- Generate:
  - 2-3 demo accounts (checking, savings, credit card)
  - 3-5 demo categories (groceries, utilities, entertainment, etc.)
  - 2-3 demo bills (rent, internet, phone)
  - 1-2 demo goals (vacation fund, emergency fund)
  - 1 demo debt (credit card)
  - 10-15 demo transactions (mix of income/expense, various dates)
- Use realistic but clearly demo data (e.g., "Demo Grocery Store", "Demo Rent Payment")
- All data should be marked as demo/test data (consider adding `isDemo` flag to schema if needed)
- Use Decimal.js for all monetary values
- Set dates to past 30-60 days for transactions

#### Step 3.4: Update Onboarding Steps for Demo Mode
**Files:** 
- `components/onboarding/steps/create-household-step.tsx`
- `components/onboarding/steps/create-account-step.tsx`
- `components/onboarding/steps/create-bill-step.tsx`
- `components/onboarding/steps/create-goal-step.tsx`
- `components/onboarding/steps/create-debt-step.tsx`
- `components/onboarding/steps/create-transaction-step.tsx`

- Check `isDemoMode` from onboarding context
- If demo mode:
  - Pre-fill forms with demo data
  - Show banner: "Creating demo data for practice"
  - Auto-submit forms with demo data
  - Skip user interaction (or make it optional)
- If not demo mode: Keep existing behavior

#### Step 3.5: Create Demo Data Generation API Endpoint
**File:** `app/api/onboarding/generate-demo-data/route.ts` (new file)

- POST endpoint: Generate demo data for invited user
- Request body: `{ householdId }`
- Validate user is authenticated and member of household
- Call `generateDemoData()` utility
- Return: `{ success: true, accountsCreated: number, transactionsCreated: number, ... }`
- Handle errors gracefully

#### Step 3.6: Update Welcome Step for Invited Users
**File:** `components/onboarding/steps/welcome-step.tsx`

- Check if user is invited (from onboarding context)
- If invited:
  - Show different welcome message: "Welcome to [Household Name]!"
  - Explain: "We'll create some demo data so you can practice without affecting real finances"
  - Update step descriptions to mention demo data
- Use semantic theme variables

#### Step 3.7: Update Complete Step for Invited Users
**File:** `components/onboarding/steps/complete-step.tsx`

- Check if user is invited
- If invited:
  - Show message: "Demo data created! You can now explore the app with sample data."
  - Add button: "Clear Demo Data" (optional, for later)
  - Redirect to dashboard (not household creation)
- If not invited: Keep existing behavior

#### Step 3.8: Handle Invitation Acceptance Flow
**File:** `app/invite/[token]/page.tsx`

- After accepting invitation:
  - If user is new (just signed up): Redirect to onboarding with invitation context
  - If user is existing: Redirect to dashboard and switch to invited household
- Store invitation token in localStorage temporarily for onboarding flow
- Clear token after onboarding completes

---

## Database Schema Updates

### No Schema Changes Required
- All necessary tables already exist:
  - `householdInvitations` - for invitations
  - `householdMembers` - for household membership
  - `betterAuthUser` - for user accounts
  - All financial data tables support `householdId`

### Optional Enhancement (Future)
- Consider adding `isDemo` flag to transactions/accounts/bills/etc. for easier demo data cleanup
- Migration would be: `drizzle/XXXX_add_is_demo_flag.sql`

---

## API Endpoints Summary

### New Endpoints
1. `GET /api/invitations/[token]` - Get invitation details
2. `POST /api/admin/users` - Create user (owner only)
3. `GET /api/admin/users` - List users (owner only)
4. `PUT /api/admin/users/[userId]` - Update user (owner only)
5. `DELETE /api/admin/users/[userId]` - Delete user (owner only)
6. `POST /api/onboarding/generate-demo-data` - Generate demo data

### Updated Endpoints
1. `POST /api/households/[householdId]/invitations` - Add email sending

---

## UI Components Summary

### New Components
1. `components/settings/admin-users-tab.tsx` - User management UI
2. `lib/email/templates/invitation-email.ts` - Invitation email template
3. `lib/onboarding/demo-data-generator.ts` - Demo data generation utility

### Updated Components
1. `components/settings/admin-tab.tsx` - Add user management section
2. `components/onboarding/onboarding-modal.tsx` - Handle invitation context
3. `components/onboarding/steps/*.tsx` - Support demo mode
4. `app/invite/[token]/page.tsx` - Improve UX and handle onboarding redirect
5. `app/sign-up/[[...index]]/page.tsx` - Detect invitations

---

## Testing Checklist

### Feature 1: Invite Email
- [ ] Invitation email sends when invitation is created
- [ ] Email contains correct household name and inviter name
- [ ] Email contains valid invitation link
- [ ] Email handles missing email configuration gracefully
- [ ] Invitation page displays household and inviter information

### Feature 2: Admin User Creation
- [ ] Owner can create users with email/password
- [ ] Owner can assign users to households during creation
- [ ] Owner can list all users
- [ ] Owner can update user details
- [ ] Owner can delete users (except themselves)
- [ ] Non-owners cannot access admin endpoints
- [ ] Password validation works correctly
- [ ] Duplicate email handling works

### Feature 3: Invited User Onboarding
- [ ] Invited users see special onboarding flow
- [ ] Demo data is generated correctly
- [ ] Demo data doesn't interfere with real household data
- [ ] Onboarding steps work in demo mode
- [ ] Existing users accepting invitations skip onboarding
- [ ] Invitation token is handled correctly

---

## Security Considerations

1. **Invitation Tokens**
   - Tokens are already cryptographically secure (nanoid 32 chars)
   - Expiration is already handled (30 days)
   - Status validation prevents reuse

2. **Admin Endpoints**
   - All admin endpoints must verify owner status
   - Use `getCurrentUserOwnerStatus()` helper
   - Return 403 if not owner
   - Prevent owner from deleting themselves

3. **User Creation**
   - Validate password strength (min 8 chars)
   - Validate email format
   - Check for duplicate emails
   - Validate household exists and user has permission

4. **Demo Data**
   - Only generate demo data for invited users
   - Ensure demo data is isolated to correct household
   - Consider adding `isDemo` flag for future cleanup

---

## Integration Points

### Email Service
- Uses existing `lib/email/email-service.ts` infrastructure
- Follows patterns from `sendVerificationEmail()` and `sendEmailChangeVerification()`
- Supports both Resend and SMTP providers

### Authentication
- Uses Better Auth for user creation (`auth.api.signUpEmail`)
- Uses existing owner check helpers (`lib/auth/owner-helpers.ts`)
- Follows existing authentication patterns

### Onboarding
- Extends existing onboarding context
- Reuses existing onboarding step components
- Maintains backward compatibility with regular onboarding

### Household System
- Uses existing household membership system
- Follows existing permission patterns
- Integrates with household context provider

---

## Styling Guidelines

- **Always use semantic theme variables:**
  - `bg-background`, `bg-card`, `bg-elevated`
  - `text-foreground`, `text-muted-foreground`
  - `border-border`
  - `bg-[var(--color-primary)]`, `text-[var(--color-primary)]`
  - Transaction colors: `text-[var(--color-income)]`, `text-[var(--color-expense)]`

- **Follow existing UI patterns:**
  - Use shadcn/ui components (Card, Button, Dialog, Input, etc.)
  - Use consistent spacing and typography
  - Mobile-first responsive design
  - Loading states and error handling

- **Email Templates:**
  - Use inline styles (email client compatibility)
  - Responsive design (max-width 600px)
  - Clear call-to-action buttons
  - Professional but friendly tone

---

## Implementation Order

1. **Feature 1: Invite Email** (4-6 hours)
   - Step 1.1: Create email template
   - Step 1.2: Update invitation API
   - Step 1.3: Add email service export
   - Step 1.4: Update invitation page
   - Step 1.5: Create invitation details API

2. **Feature 2: Admin User Creation** (6-8 hours)
   - Step 2.1: Create user creation API
   - Step 2.2: Create user list API
   - Step 2.3: Create user management UI
   - Step 2.4: Add to admin tab
   - Step 2.5: Create update API
   - Step 2.6: Create delete API

3. **Feature 3: Invited User Onboarding** (6-8 hours)
   - Step 3.1: Add invitation context
   - Step 3.2: Detect invited users
   - Step 3.3: Create demo data generator
   - Step 3.4: Update onboarding steps
   - Step 3.5: Create demo data API
   - Step 3.6: Update welcome step
   - Step 3.7: Update complete step
   - Step 3.8: Handle invitation acceptance

**Total Estimated Time:** 16-22 hours (2-3 days)

---

## Notes

- All features should be implemented with proper error handling
- All API endpoints should include proper authentication/authorization checks
- All UI components should use semantic theme variables
- All database operations should use Drizzle ORM
- All monetary calculations should use Decimal.js
- Consider adding rate limiting for admin endpoints (future enhancement)
- Consider adding audit logging for admin actions (future enhancement)


