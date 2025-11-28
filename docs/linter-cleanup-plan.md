# Linter Cleanup Plan

**Last Updated:** 2025-11-28

## Phase 1: Fix Warnings - ✅ COMPLETE

**Status:** 360 warnings fixed, 0 remaining in lib/, app/api/, and components/

| Directory | Warnings Fixed | Status |
|-----------|----------------|--------|
| lib/ | 36 | ✅ Complete |
| app/api/ | 114 | ✅ Complete |
| components/ | 210 | ✅ Complete |
| **Total** | **360** | **✅ Complete** |

### Fix Categories Applied
- Removed/prefixed unused imports, variables, parameters with `_`
- Wrapped 19 fetch functions in `useCallback`
- Added eslint-disable for known library issues

---

## Phase 2: Fix Errors - ⏳ IN PROGRESS (66% Complete)

**Status:** 67 errors remaining (down from 196)
**Detailed Plan:** See `docs/linter-phase2-plan.md`

### Progress
- ✅ Fixed all 75 `react/no-unescaped-entities` errors
- ✅ Created `lib/types/index.ts` with shared TypeScript interfaces
- ✅ Fixed 54 of 121 `@typescript-eslint/no-explicit-any` errors
- ⏳ 67 `@typescript-eslint/no-explicit-any` errors remaining

---

## Remaining Work

1. **Phase 2 Completion** - See `docs/linter-phase2-plan.md` for detailed file list
2. **Other directories (warnings only)**
   - __tests__/, scripts/, contexts/, hooks/

---

## Verification Commands

```bash
# Check errors in components
pnpm eslint components/ --format stylish 2>&1 | grep -E "error|✖"

# Full build verification
pnpm build
```
