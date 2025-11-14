# Bugs Status (Updated 2025-11-12)

---

## 🆕 ADD NEW BUGS HERE
1. ## Error Type
Build Error

## Error Message
Export validateImageFile doesn't exist in target module

## Build Output
./app/api/profile/avatar/upload/route.ts:7:1
Export validateImageFile doesn't exist in target module
   5 | import { writeFile, unlink } from 'fs/promises';
   6 | import { join } from 'path';
>  7 | import {
     | ^^^^^^^^
>  8 |   validateImageFile,
     | ^^^^^^^^^^^^^^^^^^^^
>  9 |   optimizeImage,
     | ^^^^^^^^^^^^^^^^^^^^
> 10 |   fileToBuffer,
     | ^^^^^^^^^^^^^^^^^^^^
> 11 |   getFileExtension,
     | ^^^^^^^^^^^^^^^^^^^^
> 12 | } from '@/lib/avatar-utils';
     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  13 |
  14 | export const dynamic = 'force-dynamic';
  15 |

The export validateImageFile was not found in module [project]/lib/avatar-utils.ts [app-route] (ecmascript).
Did you mean to import optimizeImage?
All exports of the module are statically known (It doesn't have dynamic exports). So it's known statically that the requested export doesn't exist.

Next.js version: 16.0.1 (Turbopack)

---

## 📊 Current Status

**Active Bugs:** 0
**In Progress:** 0
**Fixed (All Time):** 14

---

## ✅ Historical Bug Summary

All 14 tracked bugs have been fixed (100% complete)! 🎉

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
12. **Reports Charts Dimension Warnings (Multiple Components)** - Changed ResponsiveContainer in all chart components to use explicit `height={320}` instead of `height="100%"`
13. **Image Aspect Ratio Warning** - Added explicit `style={{ height: 'auto' }}` to both logo Image components in sidebar for proper aspect ratio maintenance
14. **Clerk Redirect URL Deprecation** - Updated environment variables from deprecated `AFTER_SIGN_IN_URL` to new `SIGN_IN_FALLBACK_REDIRECT_URL` for better redirect handling and to eliminate deprecation warnings

**For detailed information, see git commit history.**

---

## 💡 Known Minor Issues (Not Blocking)

These are minor warnings/deprecations that don't affect functionality:

1. **Middleware Convention:** Next.js deprecation warning - "middleware" file convention should use "proxy" instead

**Note:** These don't require immediate action but can be addressed as polish improvements.
