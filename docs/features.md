# Rules System Enhancements

## Phase 1: Description & Merchant Modification (PARTIAL - Backend Complete)
**Status:** Backend implementation complete, UI pending
**Plan:** `docs/rules-actions-implementation-plan.md`
**Completed:**
- ✅ Database schema updates (actions + appliedActions columns)
- ✅ Migration script (0020_add_rule_actions.sql) - executed successfully
- ✅ Type system (lib/rules/types.ts) - 9 action types defined
- ✅ Rule matcher updated (lib/rules/rule-matcher.ts) - returns actions array
- ✅ Actions executor (lib/rules/actions-executor.ts) - 5 action types implemented
- ✅ Transaction creation API integrated with actions
- ✅ Bulk apply rules API integrated with actions
- ✅ Rules CRUD API supports actions
- ✅ Pattern variables for descriptions ({original}, {merchant}, {category}, {amount}, {date})
- ✅ Backward compatibility with existing rules

**Implemented Actions:**
1. ✅ **Set Category** - Assigns transaction category
2. ✅ **Set Description** - Replaces entire description with pattern
3. ✅ **Prepend Description** - Adds text before description
4. ✅ **Append Description** - Adds text after description
5. ✅ **Set Merchant** - Assigns merchant to transaction

**Pending:**
- ⏳ Rule builder UI component (actions section)
- ⏳ Pattern builder UI for description modifications
- ⏳ Merchant selector UI for set_merchant action
- ⏳ Rules list UI updates (show action count/preview)
- ⏳ Rule details modal with full action list
- ⏳ Unit tests for actions executor
- ⏳ Integration tests
- ⏳ End-to-end testing
- ⏳ User documentation

## Phase 2: Advanced Actions (Future)
**Status:** Not started
**Plan:** See `docs/rules-actions-implementation-plan.md` (Phase 2 section)

3. ⏳ Make the transfer conversion more robust, with transaction matching and suggestions
4. ⏳ Allow converting to transfer with a rule
5. ⏳ Allow splitting transactions with a rule
6. ⏳ Allow changing the bank account with a rule
7. ⏳ Allow setting tax deduction with a rule

**Note:** Action types for Phase 2 are defined in the type system but not yet implemented in the actions executor.
