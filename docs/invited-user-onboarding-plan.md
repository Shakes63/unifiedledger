# Invited User Onboarding Implementation Plan

## Overview
This plan details the implementation of a special onboarding flow for invited users that creates demo data instead of real data, preventing interference with existing household finances. This allows new users to practice and learn the application without affecting the actual financial data of the household they've been invited to.

**Status:** Planning Complete - Ready for Implementation  
**Estimated Time:** 6-8 hours  
**Last Updated:** 2025-01-16

---

## Current State

### ✅ Completed
- Onboarding flow exists (`components/onboarding/onboarding-modal.tsx`)
- Onboarding context exists (`contexts/onboarding-context.tsx`)
- Multiple onboarding steps exist (household, account, bill, goal, debt, transaction)
- Invitation system exists (`app/invite/[token]/page.tsx`)
- Invitation acceptance API exists (`/api/invitations/accept`)
- Sign-up page exists (`app/sign-up/[[...index]]/page.tsx`)

### ❌ Missing
- Detection of invited users during sign-up
- Invitation context in onboarding system
- Demo data generation utility
- Special onboarding flow that creates demo data
- Demo mode flag in onboarding steps
- Updated welcome and complete steps for invited users
- Invitation token handling in sign-up flow

---

## Implementation Steps

### Step 1: Add Invitation Context to Onboarding
**File:** `contexts/onboarding-context.tsx`

**Purpose:** Extend onboarding context to track invitation status and demo mode

**Changes:**
1. Add new state variables:
   - `isInvitedUser: boolean` - Whether user is joining via invitation
   - `invitationHouseholdId: string | null` - The household ID they're joining
   - `isDemoMode: boolean` - Whether to create demo data instead of real data
   - `invitationToken: string | null` - Store invitation token temporarily

2. Add new method:
   - `setInvitationContext(householdId: string, token: string)` - Set invitation context
   - `clearInvitationContext()` - Clear invitation context after onboarding

3. Update context interface:
   ```typescript
   interface OnboardingContextType {
     // ... existing properties
     isInvitedUser: boolean;
     invitationHouseholdId: string | null;
     isDemoMode: boolean;
     invitationToken: string | null;
     setInvitationContext: (householdId: string, token: string) => void;
     clearInvitationContext: () => void;
   }
   ```

4. Initialize state:
   - Check localStorage for invitation token on mount
   - If token exists, fetch invitation details and set context
   - Clear token from localStorage after use

**Implementation Details:**
- Use `useState` for new state variables
- Add `useEffect` to check localStorage on mount
- Create helper functions for setting/clearing context
- Update context provider to include new values

---

### Step 2: Create Demo Data Generation Utility
**File:** `lib/onboarding/demo-data-generator.ts` (new file)

**Purpose:** Generate realistic demo data for invited users to practice with

**Function Signature:**
```typescript
export async function generateDemoData(
  householdId: string,
  userId: string
): Promise<{
  accountsCreated: number;
  categoriesCreated: number;
  billsCreated: number;
  goalsCreated: number;
  debtsCreated: number;
  transactionsCreated: number;
}>
```

**Demo Data to Generate:**

1. **Accounts (2-3 accounts):**
   - Checking Account: "Demo Checking" - $5,000 balance
   - Savings Account: "Demo Savings" - $10,000 balance
   - Credit Card: "Demo Credit Card" - $500 balance, $5,000 limit

2. **Categories (5 categories):**
   - Groceries (variable_expense)
   - Utilities (monthly_bill)
   - Entertainment (variable_expense)
   - Rent (monthly_bill)
   - Income (income)

3. **Bills (2-3 bills):**
   - Rent: $1,200/month, due on 1st
   - Internet: $79.99/month, due on 15th
   - Phone: $89.99/month, due on 20th

4. **Goals (1-2 goals):**
   - Vacation Fund: $5,000 target, $1,200 current
   - Emergency Fund: $10,000 target, $3,500 current

5. **Debts (1 debt):**
   - Credit Card: $500 balance, $5,000 limit, 18% APR, minimum payment $25

6. **Transactions (10-15 transactions):**
   - Mix of income and expenses
   - Dates spread over past 30-60 days
   - Realistic amounts and descriptions
   - Examples:
     - "Demo Salary" - Income - $3,500
     - "Demo Grocery Store" - Expense - $125.50
     - "Demo Utility Company" - Expense - $89.99
     - "Demo Coffee Shop" - Expense - $4.50
     - "Demo Gas Station" - Expense - $45.00

**Implementation Details:**
- Use Decimal.js for all monetary calculations
- Use `nanoid()` for generating IDs
- Use realistic dates (past 30-60 days for transactions)
- Prefix all names with "Demo" to clearly identify demo data
- Use existing API patterns for creating data (or direct database inserts)
- Handle errors gracefully
- Return counts of created items

**Naming Conventions:**
- Accounts: "Demo [Type]" (e.g., "Demo Checking", "Demo Savings")
- Categories: "Demo [Name]" (e.g., "Demo Groceries", "Demo Rent")
- Bills: "Demo [Name]" (e.g., "Demo Rent", "Demo Internet")
- Goals: "Demo [Name]" (e.g., "Demo Vacation Fund")
- Debts: "Demo [Name]" (e.g., "Demo Credit Card")
- Transactions: "Demo [Description]" (e.g., "Demo Grocery Store", "Demo Salary")

**Database Operations:**
- Use Drizzle ORM for all database operations
- Ensure all data is associated with correct `householdId` and `userId`
- Set appropriate timestamps
- Use proper enums for types

---

### Step 3: Create Demo Data Generation API Endpoint
**File:** `app/api/onboarding/generate-demo-data/route.ts` (new file)

**Purpose:** API endpoint to generate demo data for invited users

**Endpoint:** `POST /api/onboarding/generate-demo-data`

**Request Body:**
```typescript
{
  householdId: string;
}
```

**Response:**
```typescript
{
  success: true;
  accountsCreated: number;
  categoriesCreated: number;
  billsCreated: number;
  goalsCreated: number;
  debtsCreated: number;
  transactionsCreated: number;
}
```

**Implementation:**
1. Validate user is authenticated (`requireAuth()`)
2. Validate `householdId` is provided
3. Verify user is a member of the household (`requireHouseholdAuth()`)
4. Call `generateDemoData()` utility function
5. Return success response with counts
6. Handle errors gracefully

**Error Handling:**
- 401: Unauthorized (not authenticated)
- 400: Missing householdId
- 403: User is not a member of household
- 500: Internal server error

---

### Step 4: Update Sign-Up Page for Invitation Detection
**File:** `app/sign-up/[[...index]]/page.tsx`

**Purpose:** Detect invitation token and set up invitation context

**Changes:**
1. Check for invitation token in URL params (`?invitation_token=...`)
2. Check localStorage for invitation token
3. After successful sign-up:
   - If invitation token exists:
     - Accept invitation automatically (call `/api/invitations/accept`)
     - Store invitation token and household ID in localStorage
     - Set flag to redirect to onboarding with invitation context
   - If no invitation token: Continue with normal flow

4. Redirect logic:
   - If invitation accepted: Redirect to `/dashboard?onboarding=true&invited=true`
   - Otherwise: Redirect to `/dashboard` (normal flow)

**Implementation Details:**
- Use `useSearchParams()` to check for `invitation_token` param
- Store token in localStorage with key: `unified-ledger:invitation-token`
- Store household ID with key: `unified-ledger:invitation-household-id`
- Clear tokens after use
- Handle errors gracefully (if invitation acceptance fails, still allow sign-up)

**Flow:**
1. User clicks invitation link → redirected to sign-up with token
2. User signs up → token stored in localStorage
3. After sign-up → accept invitation API called
4. Redirect to dashboard → onboarding detects invitation context
5. Onboarding starts in demo mode

---

### Step 5: Update Invitation Acceptance Page
**File:** `app/invite/[token]/page.tsx`

**Purpose:** Handle invitation acceptance and redirect appropriately

**Changes:**
1. After accepting invitation:
   - Check if user is new (just signed up) or existing
   - If new user:
     - Store invitation token in localStorage
     - Store household ID in localStorage
     - Redirect to `/dashboard?onboarding=true&invited=true`
   - If existing user:
     - Redirect to dashboard and switch to invited household
     - Skip onboarding

2. Detect new user:
   - Check if user has completed onboarding
   - If not completed → treat as new user
   - If completed → treat as existing user

**Implementation Details:**
- Use `betterAuthClient.useSession()` to check if user is signed in
- Check onboarding status via API or localStorage
- Store invitation context in localStorage
- Use router to redirect appropriately

---

### Step 6: Update Welcome Step for Invited Users
**File:** `components/onboarding/steps/welcome-step.tsx`

**Purpose:** Show different welcome message for invited users

**Changes:**
1. Check `isInvitedUser` from onboarding context
2. If invited:
   - Show welcome message: "Welcome to [Household Name]!"
   - Fetch household name from API or context
   - Explain demo data: "We'll create some demo data so you can practice without affecting real finances"
   - Update step descriptions to mention demo data
   - Show banner: "Demo Mode - Creating practice data"

3. If not invited:
   - Keep existing welcome message and behavior

**UI Updates:**
- Use semantic theme variables for styling
- Add banner component for demo mode indicator
- Update text to be invitation-specific
- Use household name in welcome message

**Implementation:**
- Import `useOnboarding` hook
- Check `isInvitedUser` and `invitationHouseholdId`
- Fetch household name if needed
- Conditionally render different content

---

### Step 7: Update Onboarding Steps for Demo Mode
**Files:**
- `components/onboarding/steps/create-household-step.tsx`
- `components/onboarding/steps/create-account-step.tsx`
- `components/onboarding/steps/create-bill-step.tsx`
- `components/onboarding/steps/create-goal-step.tsx`
- `components/onboarding/steps/create-debt-step.tsx`
- `components/onboarding/steps/create-transaction-step.tsx`

**Purpose:** Auto-create demo data in demo mode, skip user interaction

**Changes for Each Step:**

1. **Create Household Step:**
   - If demo mode: Skip this step entirely (household already exists)
   - Auto-advance to next step

2. **Create Account Step:**
   - If demo mode:
     - Show banner: "Creating demo accounts..."
     - Auto-create 2-3 demo accounts via API
     - Show loading state
     - Auto-advance after creation
   - If not demo mode: Keep existing behavior

3. **Create Bill Step:**
   - If demo mode:
     - Show banner: "Creating demo bills..."
     - Auto-create 2-3 demo bills via API
     - Show loading state
     - Auto-advance after creation
   - If not demo mode: Keep existing behavior

4. **Create Goal Step:**
   - If demo mode:
     - Show banner: "Creating demo goals..."
     - Auto-create 1-2 demo goals via API
     - Show loading state
     - Auto-advance after creation
   - If not demo mode: Keep existing behavior

5. **Create Debt Step:**
   - If demo mode:
     - Show banner: "Creating demo debt..."
     - Auto-create 1 demo debt via API
     - Show loading state
     - Auto-advance after creation
   - If not demo mode: Keep existing behavior

6. **Create Transaction Step:**
   - If demo mode:
     - Show banner: "Creating demo transactions..."
     - Auto-create 10-15 demo transactions via API
     - Show loading state
     - Auto-advance after creation
   - If not demo mode: Keep existing behavior

**Implementation Pattern:**
```typescript
const { isDemoMode, invitationHouseholdId } = useOnboarding();

useEffect(() => {
  if (isDemoMode && invitationHouseholdId) {
    // Auto-create demo data
    createDemoData();
  }
}, [isDemoMode, invitationHouseholdId]);

const createDemoData = async () => {
  setLoading(true);
  try {
    // Call demo data generation API or create directly
    await generateDemoDataForStep();
    onNext(); // Auto-advance
  } catch (error) {
    console.error('Failed to create demo data:', error);
    // Show error but allow user to continue
  } finally {
    setLoading(false);
  }
};
```

**Alternative Approach:**
Instead of creating data in each step, create all demo data at once in the welcome step or a dedicated demo data step, then skip remaining steps.

**Recommended Approach:**
Create all demo data in a single step (after welcome, before account step) to avoid multiple API calls and ensure consistency.

---

### Step 8: Create Demo Data Creation Step (Alternative)
**File:** `components/onboarding/steps/create-demo-data-step.tsx` (new file)

**Purpose:** Single step that creates all demo data at once

**Implementation:**
- Show loading state: "Creating demo data..."
- Call `/api/onboarding/generate-demo-data` endpoint
- Display progress: "Creating accounts...", "Creating transactions...", etc.
- Show success message with counts
- Auto-advance to complete step
- Skip all other creation steps if in demo mode

**Benefits:**
- Single API call instead of multiple
- Better user experience (faster)
- Easier to maintain
- Consistent data creation

**Integration:**
- Add as step 2 (after welcome, before account)
- Only show if `isDemoMode === true`
- Skip if not in demo mode

---

### Step 9: Update Complete Step for Invited Users
**File:** `components/onboarding/steps/complete-step.tsx`

**Purpose:** Show different completion message for invited users

**Changes:**
1. Check `isInvitedUser` from onboarding context
2. If invited:
   - Show message: "Demo data created! You can now explore the app with sample data."
   - Show summary of created demo data (counts)
   - Add note: "All demo data is clearly marked and won't affect real household finances"
   - Redirect to dashboard (not household creation)
   - Clear invitation context from localStorage
3. If not invited:
   - Keep existing completion message and behavior

**UI Updates:**
- Use semantic theme variables
- Show demo data summary
- Add helpful tips for exploring demo data
- Clear call-to-action to go to dashboard

---

### Step 10: Update Onboarding Modal for Invitation Context
**File:** `components/onboarding/onboarding-modal.tsx`

**Purpose:** Initialize invitation context on mount

**Changes:**
1. On mount, check localStorage for invitation token
2. If token exists:
   - Fetch invitation details from API
   - Set invitation context in onboarding context
   - Mark as demo mode
   - Clear token from localStorage after use
3. Skip household creation step if in demo mode
4. Adjust step order/numbering if needed

**Implementation:**
- Use `useEffect` to check localStorage on mount
- Call `/api/invitations/[token]` to get invitation details
- Use `setInvitationContext()` from onboarding context
- Handle errors gracefully

---

## Database Schema Updates

### No Schema Changes Required
- All necessary tables already exist
- Demo data will be stored in the same tables as real data
- Demo data can be identified by naming convention ("Demo" prefix)
- Future enhancement: Add `isDemo` boolean flag to tables for easier cleanup

### Optional Future Enhancement
Consider adding `isDemo` flag to:
- `accounts` table
- `budgetCategories` table
- `bills` table
- `savingsGoals` table
- `debts` table
- `transactions` table

This would allow:
- Easy filtering of demo data
- Bulk deletion of demo data
- Preventing demo data from affecting reports/calculations

---

## API Endpoints Summary

### New Endpoints
1. `POST /api/onboarding/generate-demo-data` - Generate demo data for invited user

### Updated Endpoints
None (all existing endpoints work as-is)

---

## UI Components Summary

### New Components
1. `lib/onboarding/demo-data-generator.ts` - Demo data generation utility
2. `components/onboarding/steps/create-demo-data-step.tsx` - Single step to create all demo data (optional)

### Updated Components
1. `contexts/onboarding-context.tsx` - Add invitation context
2. `app/sign-up/[[...index]]/page.tsx` - Detect invitation token
3. `app/invite/[token]/page.tsx` - Handle new user redirect
4. `components/onboarding/steps/welcome-step.tsx` - Show invitation-specific welcome
5. `components/onboarding/steps/complete-step.tsx` - Show invitation-specific completion
6. `components/onboarding/steps/create-household-step.tsx` - Skip in demo mode
7. `components/onboarding/steps/create-account-step.tsx` - Auto-create in demo mode (or skip)
8. `components/onboarding/steps/create-bill-step.tsx` - Auto-create in demo mode (or skip)
9. `components/onboarding/steps/create-goal-step.tsx` - Auto-create in demo mode (or skip)
10. `components/onboarding/steps/create-debt-step.tsx` - Auto-create in demo mode (or skip)
11. `components/onboarding/steps/create-transaction-step.tsx` - Auto-create in demo mode (or skip)
12. `components/onboarding/onboarding-modal.tsx` - Initialize invitation context

---

## User Flow

### Invited New User Flow:
1. User receives invitation email with link
2. User clicks link → redirected to `/invite/[token]`
3. User clicks "Sign in and Accept" → redirected to sign-up with token
4. User signs up → token stored in localStorage
5. After sign-up → invitation accepted automatically
6. Redirected to dashboard → onboarding modal opens
7. Onboarding detects invitation context → enters demo mode
8. Welcome step shows: "Welcome to [Household Name]!"
9. Demo data step creates all demo data automatically
10. Complete step shows: "Demo data created! Explore the app."
11. User redirected to dashboard with demo data

### Invited Existing User Flow:
1. User receives invitation email with link
2. User clicks link → redirected to `/invite/[token]`
3. User is already signed in
4. User clicks "Accept Invitation"
5. Invitation accepted → user added to household
6. Redirected to dashboard → household switched automatically
7. No onboarding (user already completed it)

---

## Testing Checklist

### Functionality
- [ ] Invitation token detected in sign-up URL
- [ ] Invitation token stored in localStorage
- [ ] Invitation accepted automatically after sign-up
- [ ] Onboarding context initialized with invitation data
- [ ] Demo mode activated for invited users
- [ ] Demo data generated correctly
- [ ] All demo data prefixed with "Demo"
- [ ] Demo data associated with correct household
- [ ] Welcome step shows household name for invited users
- [ ] Demo data step creates all data successfully
- [ ] Complete step shows demo data summary
- [ ] Invitation context cleared after onboarding
- [ ] Existing users skip onboarding when accepting invitation
- [ ] Household switched automatically for existing users

### Edge Cases
- [ ] Invalid invitation token handled gracefully
- [ ] Expired invitation token handled gracefully
- [ ] Already accepted invitation handled gracefully
- [ ] Demo data generation fails gracefully
- [ ] Network errors during demo data creation handled
- [ ] User cancels onboarding mid-way
- [ ] Multiple invitation tokens in localStorage handled

### UI/UX
- [ ] Demo mode banner displays correctly
- [ ] Loading states show during demo data creation
- [ ] Error messages are user-friendly
- [ ] All text uses semantic theme variables
- [ ] Mobile responsive design works
- [ ] Keyboard navigation works
- [ ] Screen reader announcements work

---

## Security Considerations

1. **Invitation Token Validation**
   - Validate token format
   - Check expiration
   - Verify status (pending, not accepted/expired)
   - Prevent token reuse

2. **Household Membership**
   - Verify user is member of household before creating demo data
   - Use `requireHouseholdAuth()` helper
   - Prevent cross-household data creation

3. **Demo Data Isolation**
   - Ensure demo data is only created in invited household
   - Verify `householdId` matches invitation
   - Prevent demo data creation outside invitation flow

4. **User Authentication**
   - Require authentication for demo data generation
   - Verify user owns the data being created
   - Prevent unauthorized demo data creation

---

## Integration Points

### Onboarding System
- Extends existing onboarding context
- Reuses existing onboarding step components
- Maintains backward compatibility with regular onboarding

### Invitation System
- Integrates with existing invitation API
- Uses existing invitation acceptance flow
- Works with existing invitation page

### Household System
- Uses existing household membership system
- Respects household isolation
- Works with household context provider

### Database
- Uses existing database schema
- Follows existing data creation patterns
- Uses Drizzle ORM for all operations

---

## Styling Guidelines

- **Always use semantic theme variables:**
  - `bg-background`, `bg-card`, `bg-elevated`
  - `text-foreground`, `text-muted-foreground`
  - `border-border`
  - `bg-[var(--color-primary)]`, `text-[var(--color-primary)]`
  - `bg-[var(--color-warning)]` for demo mode banners
  - `bg-[var(--color-success)]` for success messages

- **Follow existing UI patterns:**
  - Use shadcn/ui components (Card, Button, Dialog, etc.)
  - Use consistent spacing and typography
  - Mobile-first responsive design
  - Loading states and error handling

- **Demo Mode Indicators:**
  - Use banner component for demo mode notice
  - Use warning color for demo mode indicators
  - Clearly label all demo data

---

## Implementation Order

1. **Step 1:** Add Invitation Context to Onboarding (1 hour)
   - Update `contexts/onboarding-context.tsx`
   - Add state variables and methods
   - Test context updates

2. **Step 2:** Create Demo Data Generation Utility (2 hours)
   - Create `lib/onboarding/demo-data-generator.ts`
   - Implement all demo data generation
   - Test data creation

3. **Step 3:** Create Demo Data API Endpoint (30 min)
   - Create `app/api/onboarding/generate-demo-data/route.ts`
   - Test endpoint

4. **Step 4:** Update Sign-Up Page (1 hour)
   - Detect invitation token
   - Accept invitation automatically
   - Store context in localStorage

5. **Step 5:** Update Invitation Page (30 min)
   - Handle new user redirect
   - Store invitation context

6. **Step 6:** Update Welcome Step (30 min)
   - Show invitation-specific welcome
   - Fetch household name

7. **Step 7:** Create Demo Data Step (1 hour)
   - Create `components/onboarding/steps/create-demo-data-step.tsx`
   - Integrate into onboarding flow

8. **Step 8:** Update Other Steps for Demo Mode (1 hour)
   - Skip steps in demo mode
   - Add demo mode checks

9. **Step 9:** Update Complete Step (30 min)
   - Show invitation-specific completion
   - Clear invitation context

10. **Step 10:** Update Onboarding Modal (30 min)
    - Initialize invitation context
    - Handle demo mode flow

**Total Estimated Time:** 6-8 hours

---

## Notes

- All API calls must include `credentials: 'include'` for cookie-based authentication
- All monetary values must use Decimal.js (not floating-point arithmetic)
- All dates should be formatted consistently (use date-fns)
- All error messages should be user-friendly and actionable
- Demo data should be clearly identifiable (use "Demo" prefix)
- Consider adding `isDemo` flag to schema in future (for easier cleanup)
- Demo data can be manually deleted by users if needed
- Consider adding "Clear Demo Data" button in settings (future enhancement)

---

## Future Enhancements

1. **Demo Data Cleanup**
   - Add "Clear Demo Data" button in settings
   - Bulk delete all demo data
   - Add confirmation dialog

2. **Demo Data Filtering**
   - Filter demo data from reports
   - Hide demo data in main views (optional)
   - Add toggle to show/hide demo data

3. **Demo Data Customization**
   - Allow users to customize demo data amounts
   - Let users choose which demo data to create
   - Add more demo data options

4. **Demo Data Expiration**
   - Auto-delete demo data after 30 days
   - Prompt users to convert demo data to real data
   - Add demo data expiration notice

5. **Demo Data Conversion**
   - Allow users to convert demo data to real data
   - Remove "Demo" prefix from names
   - Update data flags

