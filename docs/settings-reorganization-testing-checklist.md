# Settings Reorganization Testing Checklist

## Phase 5: Testing & Validation

### ✅ Compilation Check
- [x] Build completes successfully (`pnpm build`)
- [x] No TypeScript errors in settings components
- [x] All imports resolve correctly

### Account Section Testing

#### Navigation
- [ ] Account tab is visible and clickable
- [ ] Default tab is "Profile" when Account section is selected
- [ ] URL updates to `?section=account&tab=profile`

#### Profile Tab
- [ ] Profile tab loads correctly
- [ ] All profile fields are editable
- [ ] Save functionality works

#### Preferences Tab (Global)
- [ ] Preferences tab loads correctly
- [ ] Description says "Your global display preferences that apply across all households"
- [ ] Currency, date format, number format, default account, first day of week are editable
- [ ] Changes save to global `user_settings` table
- [ ] Changes apply across all households

#### Privacy & Security Tab
- [ ] Privacy tab loads correctly
- [ ] All privacy settings are functional

#### Data Management Tab
- [ ] Data Management tab is now in Account section (moved from Household Settings)
- [ ] All data management features work (backups, import templates, cache clearing, reset app data)

#### Advanced Tab
- [ ] Advanced tab loads correctly
- [ ] Developer mode toggle works
- [ ] All advanced settings are functional

#### Admin Tab (if user is owner)
- [ ] Admin tab appears for owner users
- [ ] Admin tab does not appear for non-owner users
- [ ] Admin functionality works

### Households Section Testing

#### Top-Level Navigation
- [ ] Households tab is visible and clickable
- [ ] Household selector shows all user's households
- [ ] Household selector shows favorite stars
- [ ] Household selector shows member counts
- [ ] "Create New" button is visible
- [ ] Clicking a household switches to that household's settings
- [ ] URL updates to `?section=households&household=<id>&tab=members`

#### Create Household
- [ ] "Create New" button opens dialog
- [ ] Dialog has proper styling (semantic theme variables)
- [ ] Can enter household name
- [ ] Can submit to create household
- [ ] After creation, redirects to new household's Members & Access tab
- [ ] New household appears in household selector

#### Household Selector (Desktop)
- [ ] Horizontal tabs display correctly
- [ ] Active household is highlighted
- [ ] Favorite stars are clickable
- [ ] Member counts display correctly
- [ ] Switching households updates URL and content

#### Household Selector (Mobile)
- [ ] Dropdown selector displays correctly
- [ ] All households are listed
- [ ] Can select household from dropdown
- [ ] "Create New Household" option appears in dropdown

#### Members & Access Tab
- [ ] Tab loads correctly (first tab by default)
- [ ] Members list displays correctly
- [ ] Can invite new members
- [ ] Can change member roles (if permissions allow)
- [ ] Can remove members (if permissions allow)
- [ ] Can manage permissions (if permissions allow)
- [ ] Can rename household (owner only)
- [ ] Can delete household (owner only)
- [ ] Can leave household (non-owner)
- [ ] Pending invitations display correctly
- [ ] All dialogs use semantic theme variables

#### Household Preferences Tab
- [ ] Tab loads correctly
- [ ] Shows shared household preferences (fiscal year start)
- [ ] Can edit and save preferences
- [ ] Changes apply to all household members

#### Financial Settings Tab
- [ ] Tab loads correctly
- [ ] Shows shared financial settings (budget method, budget period, auto-categorization)
- [ ] Can edit and save settings
- [ ] Changes apply to all household members

#### Personal Preferences Tab
- [ ] Tab loads correctly
- [ ] Combines Theme, Notifications, and Financial Display sections
- [ ] Theme section:
  - [ ] Current theme displays correctly
  - [ ] Can select different theme
  - [ ] Can apply theme
  - [ ] Theme applies immediately
- [ ] Financial Display section:
  - [ ] Show cents toggle works
  - [ ] Negative number format selector works
  - [ ] Default transaction type selector works
  - [ ] Can save financial display settings
  - [ ] Settings are per-household (not global)
- [ ] Notifications section:
  - [ ] All notification types are listed
  - [ ] Can toggle each notification type
  - [ ] Can select delivery channels (push/email)
  - [ ] Changes save automatically
  - [ ] Settings are per-household (not global)
- [ ] All sections use semantic theme variables
- [ ] Separators between sections display correctly

### URL Navigation Testing

#### Direct URL Access
- [ ] `/dashboard/settings?section=account&tab=profile` loads Account > Profile
- [ ] `/dashboard/settings?section=account&tab=preferences` loads Account > Preferences
- [ ] `/dashboard/settings?section=account&tab=data` loads Account > Data Management
- [ ] `/dashboard/settings?section=households&household=<id>&tab=members` loads Household > Members
- [ ] `/dashboard/settings?section=households&household=<id>&tab=personal` loads Household > Personal Preferences

#### Browser Navigation
- [ ] Browser back button works correctly
- [ ] Browser forward button works correctly
- [ ] URL state persists on page refresh
- [ ] Invalid URLs redirect to default (Account > Profile)

### Styling & Theme Testing

#### Semantic Theme Variables
- [ ] All components use `bg-background`, `bg-card`, `bg-elevated` (not hardcoded colors)
- [ ] All text uses `text-foreground`, `text-muted-foreground`
- [ ] All borders use `border-border`
- [ ] All buttons use `bg-[var(--color-primary)]` for primary actions
- [ ] All error states use `text-[var(--color-error)]`
- [ ] All warning states use `text-[var(--color-warning)]`
- [ ] Theme switching works correctly (from Personal Preferences tab)

#### Responsive Design
- [ ] Desktop layout displays correctly (horizontal tabs)
- [ ] Mobile layout displays correctly (dropdown selectors)
- [ ] Tablet layout displays correctly
- [ ] All breakpoints work as expected

### Data Migration Testing

#### Existing Data
- [ ] Existing user preferences still work
- [ ] Global preferences read from `user_settings` table
- [ ] Per-household preferences read from `user_household_preferences` table
- [ ] No data loss during migration

### Edge Cases

#### No Households
- [ ] Empty state displays correctly
- [ ] "Create Household" button is prominent
- [ ] Can create first household

#### Single Household
- [ ] Household selector shows single household
- [ ] Can still switch to Account section
- [ ] All household tabs work

#### Multiple Households
- [ ] All households display in selector
- [ ] Can switch between households
- [ ] Each household's settings are isolated
- [ ] Personal preferences are per-household

#### Permissions
- [ ] Owner can rename/delete household
- [ ] Non-owner cannot rename/delete household
- [ ] Non-owner can leave household
- [ ] Owner cannot leave household
- [ ] Permission-based UI elements show/hide correctly

### Performance Testing

#### Loading States
- [ ] Loading spinners display while fetching data
- [ ] No flash of incorrect content
- [ ] Smooth transitions between tabs

#### API Calls
- [ ] No unnecessary API calls
- [ ] API calls include credentials
- [ ] Error handling works correctly

## Test Results Summary

**Date:** [To be filled]
**Tester:** [To be filled]

### Passed Tests: ___ / ___
### Failed Tests: ___ / ___
### Notes:

---

## Known Issues

[List any issues found during testing]

---

## Next Steps

1. Fix any issues found during testing
2. Update documentation if needed
3. Mark feature as complete in `docs/features.md`

