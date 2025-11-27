# Linter Cleanup Plan

**Last Updated:** 2025-11-27

## Phase 1: Fix Warnings - ✅ COMPLETE

**Status:** 360 warnings fixed, 0 remaining in lib/, app/api/, and components/

### Summary of Fixes

| Directory | Warnings Fixed | Status |
|-----------|----------------|--------|
| lib/ | 36 | ✅ Complete |
| app/api/ | 114 | ✅ Complete |
| components/ | 210 | ✅ Complete |
| **Total** | **360** | **✅ Complete** |

### Fix Categories Applied

1. **Unused imports** - Removed or prefixed with `_`
2. **Unused caught errors** - Prefixed with `_` (e.g., `_error`)
3. **Unused variables & parameters** - Prefixed with `_`
4. **react-hooks/exhaustive-deps** - Wrapped 19 fetch functions in `useCallback` and added proper dependencies
5. **Miscellaneous** - eslint-disable comments for known library issues (TanStack Virtual, Next.js img)

---

## Phase 2: Fix Errors - ⏳ PENDING

**Status:** 196 `@typescript-eslint/no-explicit-any` errors in components/

### Current Distribution

| Directory | Error Count |
|-----------|-------------|
| components/ | 196 |
| Other directories | TBD |

### Strategy

Replace `any` types with proper TypeScript interfaces:
- API response types
- Event handler types
- Third-party library types
- Component prop types

---

## Remaining Work

1. **Other directories (warnings)**
   - __tests__/
   - scripts/
   - contexts/
   - hooks/

2. **Phase 2: Fix `@typescript-eslint/no-explicit-any` errors**
   - Create proper TypeScript interfaces
   - Replace `any` with specific types
   - Use generic types where appropriate

---

## Verification Commands

```bash
# Check warnings
pnpm eslint components/ --format stylish 2>&1 | grep -E "warning|✖"

# Check errors
pnpm eslint components/ --format stylish 2>&1 | grep -E "error|✖"

# Full build verification
pnpm build
```
