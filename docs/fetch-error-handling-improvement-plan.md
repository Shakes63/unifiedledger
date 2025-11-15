# Fetch Error Handling Improvement Plan

**Created:** 2025-11-15
**Status:** Planning Complete
**Priority:** High
**Estimated Effort:** 4-6 hours

---

## Executive Summary

Multiple "Failed to fetch" errors are occurring across the application affecting RecentTransactions, HouseholdContext, WebVitals, and SessionActivityProvider components. These errors stem from insufficient error handling, race conditions during initialization, and lack of graceful degradation when network requests fail.

**Root Causes:**
1. Components attempting to fetch before household context is initialized
2. Insufficient error handling and retry logic for network requests
3. Silent failures that don't provide user feedback
4. No offline/online detection or network state management
5. Missing graceful degradation when non-critical fetches fail

---

## Affected Components (9 Errors Total)

### High Priority (User-Facing)
1. **RecentTransactions Component** (Bugs 1-4)
   - Location: `components/dashboard/recent-transactions.tsx`
   - Issue: Calls `fetchWithHousehold` before `selectedHouseholdId` is loaded
   - Impact: Dashboard shows errors instead of loading state

2. **HouseholdContext** (Bug 5)
   - Location: `contexts/household-context.tsx`
   - Issue: `loadPreferences` fetch fails during household switching
   - Impact: Theme and preferences don't load when switching households

### Medium Priority (Background Operations)
3. **WebVitals Hook** (Bugs 6-7)
   - Location: `hooks/useWebVitals.ts`
   - Issue: `sendMetricToAnalytics` fails silently
   - Impact: Performance metrics not tracked (non-critical)

4. **SessionActivityProvider** (Bugs 8-9)
   - Location: `components/providers/session-activity-provider.tsx`
   - Issue: `pingServer` fails on initial mount
   - Impact: Session timeout tracking may not work correctly

---

## Implementation Plan

### Phase 1: Global Error Handling Infrastructure (1-2 hours)

**Goal:** Create reusable utilities for robust fetch operations

#### Task 1.1: Create Enhanced Fetch Utility
**File:** `lib/utils/enhanced-fetch.ts`

**Features:**
- Exponential backoff retry logic (3 attempts, 1s, 2s, 4s delays)
- Network connectivity detection
- Timeout handling (configurable, default 10s)
- Detailed error categorization (network, timeout, server error, client error)
- Request deduplication to prevent concurrent identical requests
- Abort controller support for cancellation

**Implementation Details:**
```typescript
interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  retryOn?: (error: Error, response?: Response) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

enum FetchErrorType {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  SERVER_ERROR = 'server_error',
  CLIENT_ERROR = 'client_error',
  ABORT = 'abort',
}

class FetchError extends Error {
  type: FetchErrorType;
  response?: Response;
  statusCode?: number;
}
```

**Integration Points:**
- Uses semantic color variables for UI consistency
- Integrates with toast notifications using `sonner`
- Works with household context for authenticated requests

#### Task 1.2: Create Network Status Context
**File:** `contexts/network-status-context.tsx`

**Features:**
- Online/offline detection using `navigator.onLine`
- Automatic detection of server availability
- Periodic server health checks (every 30s when online)
- User notification when offline/online transitions occur
- Visual indicator in UI (subtle banner or status dot)

**UI Components:**
- Offline banner (dismissible, uses `bg-[var(--color-warning)]`)
- Network status indicator in sidebar (green/red dot)
- Retry banner when server is unreachable

#### Task 1.3: Create Request Queue for Offline Support
**File:** `lib/utils/request-queue.ts`

**Features:**
- Queue failed requests when offline
- Auto-retry when connection restored
- IndexedDB persistence (already used for offline transactions)
- Request prioritization (critical vs. nice-to-have)
- Conflict resolution for stale requests

**Integration:**
- Extends existing offline sync infrastructure
- Uses same IndexedDB database (`offline-transactions`)
- Adds new store: `failed-requests`

---

### Phase 2: Fix Household Context Loading (1 hour)

**Goal:** Eliminate race conditions during household initialization

#### Task 2.1: Add Initialization State to HouseholdContext
**File:** `contexts/household-context.tsx`

**Changes:**
1. Add `initialized: boolean` state to track first load completion
2. Add `error: Error | null` state for load failures
3. Modify `refreshHouseholds` to set initialized flag
4. Add retry mechanism with exponential backoff
5. Show error state in UI when households fail to load

**Implementation:**
```typescript
interface HouseholdContextType {
  // ... existing fields
  initialized: boolean;
  error: Error | null;
  retry: () => Promise<void>;
}
```

**Loading Flow:**
1. Component mounts → `loading: true, initialized: false`
2. Fetch households → Success: `loading: false, initialized: true`
3. Fetch households → Failure: `loading: false, initialized: false, error: Error`
4. User clicks retry → Reset and try again

#### Task 2.2: Update HouseholdContext Error Handling
**File:** `contexts/household-context.tsx`

**Changes:**
1. Replace raw `fetch` with enhanced fetch utility
2. Add retry logic for failed preference loads
3. Show toast notifications for preference load failures
4. Fall back to cached preferences if fetch fails
5. Validate response data before setting state

**Error Cases:**
- Network error → Show "Offline" message, queue retry
- 401 Unauthorized → Redirect to sign-in
- 404 Not Found → Show "Household not found" error
- 500 Server Error → Show "Server error, retrying..." toast

---

### Phase 3: Fix RecentTransactions Component (1 hour)

**Goal:** Prevent fetch attempts before household is ready

#### Task 3.1: Add Guard Clauses for Household Loading
**File:** `components/dashboard/recent-transactions.tsx`

**Changes:**
1. Check `initialized` flag from household context
2. Show skeleton loading state while initializing
3. Show error state if household fails to load
4. Add manual retry button in error state
5. Gracefully handle empty household list

**Loading States:**
```typescript
// 1. Household context initializing
if (!initialized && loading) {
  return <SkeletonLoader />;
}

// 2. No households available
if (initialized && households.length === 0) {
  return <NoHouseholdsMessage />;
}

// 3. Household load error
if (error) {
  return <ErrorState error={error} onRetry={retry} />;
}

// 4. Household ready, fetching data
if (selectedHouseholdId && dataLoading) {
  return <DataLoadingSkeleton />;
}

// 5. Data loaded
return <TransactionList />;
```

#### Task 3.2: Add Retry Logic for Data Fetches
**File:** `components/dashboard/recent-transactions.tsx`

**Changes:**
1. Replace `fetchWithHousehold` with enhanced fetch
2. Add retry button in error state
3. Cache successful responses
4. Show stale data while revalidating
5. Debounce rapid refetches

**Caching Strategy:**
- Use React Query or SWR pattern (lightweight implementation)
- Cache key: `transactions-${selectedHouseholdId}-${selectedAccountId}`
- Stale time: 30 seconds
- Cache time: 5 minutes

#### Task 3.3: Create Skeleton Loading Components
**File:** `components/ui/skeletons/transaction-skeleton.tsx`

**Features:**
- Matches transaction card layout exactly
- Uses semantic color variables (`bg-[var(--color-elevated)]`)
- Animated shimmer effect
- Accessible (announces "Loading" to screen readers)

---

### Phase 4: Fix WebVitals Error Handling (30 minutes)

**Goal:** Make performance tracking truly non-blocking

#### Task 4.1: Improve WebVitals Error Handling
**File:** `hooks/useWebVitals.ts`

**Changes:**
1. Add network check before sending metrics
2. Queue metrics when offline
3. Batch metrics to reduce requests (send max 1 per 5 seconds)
4. Add circuit breaker pattern (stop trying after 3 consecutive failures)
5. Only log errors in development mode

**Implementation:**
```typescript
// Circuit breaker state
let failureCount = 0;
let lastFailureTime = 0;
const MAX_FAILURES = 3;
const CIRCUIT_RESET_TIME = 60000; // 1 minute

// Check if circuit is open (too many failures)
if (failureCount >= MAX_FAILURES) {
  const timeSinceLastFailure = Date.now() - lastFailureTime;
  if (timeSinceLastFailure < CIRCUIT_RESET_TIME) {
    // Circuit open, skip sending
    return;
  }
  // Reset circuit
  failureCount = 0;
}
```

#### Task 4.2: Make Performance Endpoint More Resilient
**File:** `app/api/performance/metrics/route.ts`

**Changes:**
1. Make authentication optional (return 200 even if unauthenticated)
2. Store metrics in separate table for unauthenticated users
3. Add rate limiting per IP
4. Validate metric data before storing
5. Return success even if storage fails (don't block client)

**Response Format:**
```typescript
// Always return 200 with status
{
  success: true,
  stored: boolean, // false if auth failed or storage failed
  message?: string // optional message for debugging
}
```

---

### Phase 5: Fix SessionActivityProvider (30 minutes)

**Goal:** Make session pinging more robust and silent

#### Task 5.1: Improve Session Ping Error Handling
**File:** `components/providers/session-activity-provider.tsx`

**Changes:**
1. Only ping when user is authenticated
2. Add network check before pinging
3. Implement exponential backoff for failures
4. Don't log errors in production
5. Pause pinging when page is hidden (Page Visibility API)

**Implementation:**
```typescript
// Check if page is visible before pinging
if (document.hidden) {
  return; // Don't ping when tab is not visible
}

// Check network status
if (!navigator.onLine) {
  return; // Don't ping when offline
}
```

#### Task 5.2: Add Session Status Indicator
**File:** `components/navigation/sidebar.tsx`

**Features:**
- Small status dot showing session health
- Green: Active session
- Yellow: Session warning (approaching timeout)
- Red: Session expired
- Gray: Offline/unknown

**Visual Design:**
- Uses semantic color variables
- Positioned near user avatar in sidebar
- Tooltip shows time until session expires
- Pulsing animation when session is expiring soon

---

### Phase 6: Global UI Improvements (1 hour)

**Goal:** Consistent error handling and user feedback across app

#### Task 6.1: Create Reusable Error Components
**Files:**
- `components/ui/error-state.tsx`
- `components/ui/offline-banner.tsx`
- `components/ui/retry-button.tsx`

**ErrorState Component:**
```typescript
interface ErrorStateProps {
  error: Error | string;
  onRetry?: () => void;
  title?: string;
  description?: string;
  showDetails?: boolean;
}
```

**Features:**
- Uses semantic color variables
- Shows user-friendly error messages
- Collapsible technical details (dev mode only)
- Retry button with loading state
- Custom icons based on error type

#### Task 6.2: Create Offline Banner Component
**File:** `components/ui/offline-banner.tsx`

**Features:**
- Fixed position banner at top of viewport
- Dismissible with localStorage persistence
- Auto-hide when connection restored
- Shows queue count if requests are pending
- Manual retry button to flush queue

**Styling:**
```css
background: var(--color-warning);
color: var(--color-background);
border-bottom: 1px solid var(--color-border);
```

#### Task 6.3: Update Root Layout with Network Providers
**File:** `app/layout.tsx`

**Changes:**
1. Wrap app in `NetworkStatusProvider`
2. Add `OfflineBanner` component at root level
3. Add error boundary for uncaught fetch errors
4. Integrate request queue with existing offline sync

**Provider Order:**
```
<HouseholdProvider>
  <NetworkStatusProvider>
    <SessionActivityProvider>
      <OfflineBanner />
      {children}
    </SessionActivityProvider>
  </NetworkStatusProvider>
</HouseholdProvider>
```

---

### Phase 7: Testing & Validation (1 hour)

**Goal:** Ensure all error cases are handled properly

#### Task 7.1: Manual Testing Checklist

**Network Scenarios:**
- [ ] Start app while offline → Shows offline banner
- [ ] Go offline while using app → Queues requests, shows banner
- [ ] Come back online → Flushes queue, hides banner
- [ ] Slow network (throttled) → Shows loading states, doesn't timeout
- [ ] Dev server not running → Shows error state with retry

**Household Scenarios:**
- [ ] Load app with no households → Shows "Create household" message
- [ ] Switch households → Preferences load correctly
- [ ] Switch households while offline → Uses cached preferences
- [ ] Delete current household → Switches to another household

**Component Error States:**
- [ ] RecentTransactions with fetch error → Shows error state with retry
- [ ] RecentTransactions with no data → Shows empty state
- [ ] Dashboard widgets with fetch errors → Degrade gracefully
- [ ] Settings page with fetch errors → Shows error inline

**Session & Performance:**
- [ ] Session ping fails → Logs error, doesn't crash app
- [ ] WebVitals endpoint fails → Metrics queued, no user impact
- [ ] Multiple rapid requests → Deduplicated
- [ ] Page hidden → No background pings

#### Task 7.2: Automated Tests

**Unit Tests:**
- Enhanced fetch utility with all error types
- Network status context state transitions
- Request queue operations
- Error component rendering

**Integration Tests:**
- Household context initialization flow
- RecentTransactions loading states
- Offline → online → queue flush

**Files to Create:**
- `lib/utils/__tests__/enhanced-fetch.test.ts`
- `contexts/__tests__/network-status-context.test.tsx`
- `components/dashboard/__tests__/recent-transactions.test.tsx`

---

## Implementation Order (Recommended)

### Day 1: Foundation (3 hours)
1. ✅ Task 1.1: Enhanced fetch utility (1 hour)
2. ✅ Task 1.2: Network status context (1 hour)
3. ✅ Task 6.1: Error UI components (1 hour)

### Day 2: Core Fixes (2 hours)
4. ✅ Task 2.1-2.2: Fix household context (1 hour)
5. ✅ Task 3.1-3.3: Fix RecentTransactions (1 hour)

### Day 3: Remaining Fixes & Testing (2 hours)
6. ✅ Task 4.1-4.2: Fix WebVitals (30 min)
7. ✅ Task 5.1-5.2: Fix SessionActivity (30 min)
8. ✅ Task 6.2-6.3: Global UI improvements (30 min)
9. ✅ Task 7.1-7.2: Testing (30 min)

---

## Success Criteria

### Functional Requirements
- ✅ No "Failed to fetch" errors in console during normal operation
- ✅ All components handle offline state gracefully
- ✅ User receives clear feedback when operations fail
- ✅ Failed requests automatically retry with backoff
- ✅ App remains functional when non-critical requests fail

### User Experience
- ✅ Loading states appear instantly (no blank screens)
- ✅ Error states show actionable messages
- ✅ Retry buttons work correctly
- ✅ Offline mode clearly indicated
- ✅ No silent failures (user always knows what's happening)

### Technical Quality
- ✅ All error handling uses enhanced fetch utility
- ✅ Network status integrated throughout app
- ✅ Request queue handles all failure scenarios
- ✅ Code follows existing patterns and style
- ✅ Semantic color variables used consistently

---

## Architecture Integration

### Existing Systems
- **Offline Sync:** Extends current IndexedDB implementation
- **Theme System:** Uses semantic color variables for all UI
- **Household Context:** Adds initialization state tracking
- **Toast Notifications:** Uses `sonner` for all user feedback

### New Utilities
- `lib/utils/enhanced-fetch.ts` - Robust fetch with retry
- `lib/utils/request-queue.ts` - Offline request management
- `contexts/network-status-context.tsx` - Network state management

### New Components
- `components/ui/error-state.tsx` - Reusable error display
- `components/ui/offline-banner.tsx` - Network status banner
- `components/ui/retry-button.tsx` - Retry action button
- `components/ui/skeletons/transaction-skeleton.tsx` - Loading skeleton

---

## Styling Guidelines

### Color Variables (Always Use These)
```typescript
// Backgrounds
'var(--color-background)'
'var(--color-card)'
'var(--color-elevated)'

// Text
'var(--color-foreground)'
'var(--color-muted-foreground)'

// Borders
'var(--color-border)'

// States
'var(--color-error)'
'var(--color-warning)'
'var(--color-success)'
'var(--color-primary)'
```

### Component Patterns
- Always use Card component for containers
- Always use Button component for actions
- Always use semantic HTML (button, not div with onClick)
- Always add aria-labels for accessibility
- Always show loading/error/empty states

---

## Rollout Strategy

### Phase 1: Silent Deployment
- Deploy infrastructure (enhanced fetch, network context)
- No UI changes yet
- Monitor for issues

### Phase 2: Component Updates
- Update components one by one
- Test each in isolation
- Roll back if issues arise

### Phase 3: UI Enhancements
- Add offline banner
- Add error states
- Add retry buttons

### Phase 4: Cleanup
- Remove old error handling code
- Update documentation
- Close all related bug tickets

---

## Risk Assessment

### Low Risk
- Enhanced fetch utility (isolated, backwards compatible)
- Error UI components (additive only)
- WebVitals improvements (non-critical feature)

### Medium Risk
- Household context changes (core functionality)
- Network status context (new global state)
- RecentTransactions refactor (visible to users)

### Mitigation Strategies
1. **Feature flags:** Add ability to disable new error handling
2. **Gradual rollout:** Update one component at a time
3. **Monitoring:** Add logging to track error rates
4. **Rollback plan:** Keep old code paths available

---

## Post-Implementation

### Monitoring
- Track fetch error rates in production
- Monitor retry success rates
- Track offline queue usage
- Measure impact on user experience

### Documentation
- Update component documentation
- Add fetch utility usage guide
- Document error handling patterns
- Create troubleshooting guide

### Future Enhancements
- Add request caching layer (React Query/SWR)
- Implement optimistic UI updates
- Add request prioritization
- Create admin dashboard for error monitoring

---

## Appendix: Error Message Guidelines

### User-Facing Messages (Friendly & Actionable)
- ❌ "Failed to fetch"
- ✅ "Unable to load transactions. Please try again."

- ❌ "Network error"
- ✅ "You appear to be offline. Changes will sync when connection is restored."

- ❌ "500 Internal Server Error"
- ✅ "Something went wrong on our end. We're working on it."

### Technical Messages (Dev Mode Only)
- Show HTTP status code
- Show request URL
- Show error stack trace
- Show retry count

### Toast Notifications
- **Error:** Red with error icon
- **Warning:** Amber with warning icon
- **Success:** Green with checkmark icon
- **Info:** Blue with info icon

All use semantic color variables:
```typescript
toast.error('Message', {
  style: {
    background: 'var(--color-error)',
    color: 'var(--color-background)',
  }
});
```

---

**Plan Status:** ✅ Complete and Ready for Implementation
**Next Step:** Begin Phase 1 - Task 1.1 (Enhanced Fetch Utility)
