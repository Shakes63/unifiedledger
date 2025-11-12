# Bugs Status (Updated 2025-11-12)

---

## 🆕 ADD NEW BUGS HERE

*Use the template below to add new bugs. Once fixed, they will be moved to the Historical Bug Summary section.*

**Template:**
```markdown
### [#] Bug Title - Status
**Problem:** Brief description
**Status:** NOT STARTED / IN PROGRESS / FIXED
**Plan File:** (if exists)
**Priority:** High / Medium / Low
**Files Modified:** (if in progress or fixed)
```

**Example:**
```markdown
### 12. Example Bug Title - IN PROGRESS
**Problem:** The widget doesn't display correctly on mobile devices
**Status:** IN PROGRESS
**Plan File:** `docs/example-bug-fix-plan.md`
**Priority:** High
**Files Modified:**
- `components/example/widget.tsx` - In progress
```

---

## 📊 Current Status

**Active Bugs:** 0
**In Progress:** 0
**Fixed (All Time):** 11

---

## ✅ Historical Bug Summary

All 11 tracked bugs have been fixed (100% complete)! 🎉

1. **Savings Goals GET 500 Error** - Enhanced error logging and handling in API route
2. **Savings Goals POST 500 Error** - Added explicit type casting for financial amounts
3. **Budget Summary 401 Unauthorized** - Integrated Clerk's `useAuth()` hook for proper authentication
4. **Bill Save Performance** - Parallelized validation queries and batch instance creation (75% faster)
5. **Budget Analytics Chart Dimension Warning** - Added explicit height and minHeight to chart wrapper
6. **Dialog Accessibility Warning** - Added `DialogDescription` to all 7 dialogs for screen reader support
7. **Budget Income Display Logic** - Reversed status logic so income exceeding budget shows as positive (green)
8. **Goals Page Console Errors** - Fixed database schema mismatch (recreated savings_goals table)
9. **Budget Export Incorrect Values** - Fixed transaction type query to properly include income categories
10. **Reports Page Chart Dimension Warnings** - Added explicit `style={{ height: '320px' }}` to ChartContainer
11. **Form Field ID/Name Attributes Missing** - Added id, name, and aria-label attributes to select dropdowns

**For detailed information, see git commit history.**

---

## 💡 Known Minor Issues (Not Blocking)

These are minor warnings/deprecations that don't affect functionality:

1. **Clerk Deprecation:** `afterSignInUrl` prop deprecated → Use `fallbackRedirectUrl` or `forceRedirectUrl` instead
2. **Image Aspect Ratio:** sidebar.tsx:119 - Image with src has width or height modified without auto
3. **Middleware Convention:** Next.js deprecation warning - "middleware" file convention should use "proxy" instead

**Note:** These don't require immediate action but can be addressed as polish improvements.
