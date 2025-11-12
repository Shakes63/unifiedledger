# Bugs Status (Updated 2025-11-12)

---

## 🆕 ADD NEW BUGS HERE

1. getting this error on the variable bills filter dropdown and the budget analytics filter dropdown: A form field element has neither an id nor a name attribute. This might prevent the browser from correctly autofilling the form.

To fix this issue, add a unique id or name attribute to a form field. This is not strictly needed, but still recommended even if you have an autocomplete attribute on the same element.

2. getting this error on the logo in the sidebar: sidebar.tsx:119 Image with src "http://localhost:3000/logo.png" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio.

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
### 11. Example Bug Title - IN PROGRESS
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
**Fixed (All Time):** 10

---

## ✅ Historical Bug Summary

All 10 tracked bugs from initial development have been fixed (100% complete)! 🎉

**Previously Fixed:**
1. Savings Goals GET 500 Error - FIXED ✅
2. Savings Goals POST 500 Error - FIXED ✅
3. Budget Summary 401 Unauthorized - FIXED ✅
4. Bill Save Performance - FIXED ✅
5. Budget Analytics Chart Dimension Warning - FIXED ✅
6. Dialog Accessibility Warning - FIXED ✅
7. Budget Income Display Logic - FIXED ✅
8. Goals Page Console Errors - FIXED ✅
9. Budget Export Incorrect Values - FIXED ✅
10. Reports Page Chart Dimension Warnings - FIXED ✅ (2025-11-12)

**For detailed information on historical bugs, see git history or commit messages.**

---

## 📚 Plan Files Reference

**Bug Fix Plans (Historical):**
- `docs/bug-fixes-implementation-plan.md` - Bugs 1-6 (original plan)
- `docs/fix-goals-page-error-plan.md` - Bug 8 (goals page fix)
- `docs/budget-income-display-logic-fix-plan.md` - Bug 7 (income display)
- `docs/budget-export-fix-plan.md` - Bug 9 (export fix)
- `docs/dialog-accessibility-completion-plan.md` - Bug 6 completion (accessibility)
- `docs/fix-reports-chart-dimensions-plan.md` - Bug 10 (reports page charts)

**New plan files should be created in the `docs/` folder with descriptive names.**

---


## 💡 Known Minor Issues (Not Blocking)

These are minor warnings/deprecations that don't affect functionality:

1. **Clerk Deprecation:** `afterSignInUrl` prop deprecated → Use `fallbackRedirectUrl` or `forceRedirectUrl` instead
2. **Image Aspect Ratio:** sidebar.tsx:119 - Image with src has width or height modified without auto
3. **Middleware Convention:** Next.js deprecation warning - "middleware" file convention should use "proxy" instead

**Note:** These don't require immediate action but can be addressed as polish improvements.

