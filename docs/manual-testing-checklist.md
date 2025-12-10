# Manual Testing Checklist

This document provides a comprehensive checklist for manually testing all features in Unified Ledger.

**Legend:** [ ] = Not tested | [x] = Tested and passed | [!] = Tested with issues

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [Transactions](#2-transactions)
3. [Accounts](#3-accounts)
4. [Bills](#4-bills)
5. [Budgets](#5-budgets)
6. [Calendar](#6-calendar)
7. [Categories](#7-categories)
8. [Merchants](#8-merchants)
9. [Goals](#9-savings-goals)
10. [Debts](#10-debts)
11. [Reports](#11-reports)
12. [Tax](#12-tax)
13. [Sales Tax](#13-sales-tax)
14. [Rules](#14-rules)
15. [Transfers](#15-transfers)
16. [CSV Import](#16-csv-import)
17. [Notifications](#17-notifications)
18. [Settings](#18-settings)
19. [Household Management](#19-household-management)
20. [Navigation & Layout](#20-navigation--layout)
21. [Offline Mode](#21-offline-mode)
22. [Onboarding](#22-onboarding)
23. [Developer Mode](#23-developer-mode)
24. [Experimental Features](#24-experimental-features)
25. [Unified Architecture (Phase 1.1)](#25-unified-architecture-phase-11)
26. [Unified Architecture (Phase 1.2)](#26-unified-architecture-phase-12)
27. [Unified Architecture (Phase 1.3)](#27-unified-architecture-phase-13)
28. [Unified Architecture (Phase 1.4)](#28-unified-architecture-phase-14)
29. [Unified Architecture (Phase 1.5)](#29-unified-architecture-phase-15)
30. [Unified Architecture (Phase 2)](#30-unified-architecture-phase-2)
31. [Unified Architecture (Phase 3)](#31-unified-architecture-phase-3)
32. [Unified Architecture (Phase 4)](#32-unified-architecture-phase-4)
33. [Unified Architecture (Phase 5)](#33-unified-architecture-phase-5)
34. [Unified Architecture (Phase 6)](#34-unified-architecture-phase-6)
35. [Unified Architecture (Phase 7)](#35-unified-architecture-phase-7)
36. [Unified Architecture (Phase 8)](#36-unified-architecture-phase-8)
37. [Unified Architecture (Phase 9)](#37-unified-architecture-phase-9)
38. [Unified Architecture (Phase 10)](#38-unified-architecture-phase-10)
39. [Unified Architecture (Phase 11)](#39-unified-architecture-phase-11)
40. [Unified Architecture (Phase 12)](#40-unified-architecture-phase-12)
41. [Unified Architecture (Phase 13)](#41-unified-architecture-phase-13)
42. [Unified Architecture (Phase 14)](#42-unified-architecture-phase-14)
43. [Unified Architecture (Phase 15)](#43-unified-architecture-phase-15)
44. [Unified Architecture (Phase 16)](#44-unified-architecture-phase-16)
45. [Unified Architecture (Phase 17)](#45-unified-architecture-phase-17)
46. [Unified Architecture (Phase 18)](#46-unified-architecture-phase-18)
47. [Unified Architecture (Phase 19)](#47-unified-architecture-phase-19)

---

## 1. Dashboard

**Tested: 2025-12-02** | **Result: PASSING**

All features verified: Stats bar, budget adherence tooltip, bills widget, budget details (collapsible), debt & credit section, credit utilization widget, debt countdown card.

- [ ] Collapse state persists across page reloads (Does NOT persist - resets to expanded on reload)
- [!] Budget Adherence tooltip in summary widget - **BLOCKED**: Help icon obscured by clickable container elements

---

## 2. Transactions

**Tested: 2025-12-02** | **Result: PASSING**

Verified: Transaction list, type colors, amounts, dates, categories, merchants, inline dropdowns (category/merchant editing), description/amount inline editing, new transaction form, edit transaction, delete confirmation, transaction details page, audit trail.

### Advanced Search
- [x] All filters work (description, account, category, date range, type)
- [x] Clear All properly resets both UI and results
- [x] Regex search and save search (experimental features)
- [x] Saved searches: list, load, delete all working

### Transaction Splits
- [x] Split builder, add splits, balance splits, per-category splits all working
- [ ] Split transaction saves correctly - NOT TESTED (would create test data)
- [ ] Split details display in transaction view - NOT TESTED

### Transaction Templates
- [x] Templates manager opens with empty state
- [ ] Can create/edit/delete/apply template - NOT TESTED (no templates exist)

### Duplicate Detection
- [ ] Duplicate warning appears for similar transactions - NOT TRIGGERED (may require exact date match)

### Transaction History
- [!] History page (`/dashboard/transaction-history`) - **ROUTE DOES NOT EXIST** - Redirects to main dashboard

---

## 3. Accounts

**Tested: 2025-12-02** | **Result: PASSING**

All features verified: Account list, cards, colors, totals, form fields (name, type, balance, color, icon), credit limit for credit cards, business feature toggles (Sales Tax, Tax Deductions), edit/delete operations.

---

## 4. Bills

**Tested: 2025-12-02** | **Result: PASSING**

All features verified: Bills list, status indicators, new bill form (all 7 frequencies), bill details, edit form, bill instances (mark paid/skip/link transaction via modal), annual planning grid.

### Bill Auto-Detection
- [ ] Creating expense transaction checks for bill matches - Not tested
- [ ] High-confidence matches auto-link - Not tested
- [ ] Manual linking option available - Not tested

---

## 5. Budgets

**Tested: 2025-12-01** | **Result: PASSING**

All features verified: Budget list, cards, progress bars, budget manager modal, analytics (trends, adherence), debt budget integration with focus debt and individual status indicators, budget summary page.

- [ ] Budget templates - Not fully tested
- [ ] Variable bill tracking - N/A (no variable bills)
- [ ] Apply surplus modal - Not tested
- [ ] Export functionality - Not tested

---

## 6. Calendar

**Tested: 2025-11-30** | **Result: PASSING**

All features verified: Month/week view toggle, day indicators (income/expense/bills), day modal with transactions, goal deadlines on calendar.

### Debt Milestones on Calendar
- [ ] Debts with target payoff dates show on calendar - NOT TESTABLE (test debts lack targetPayoffDate)
- [x] Code verified: Full debt milestone support exists

---

## 7. Categories

**Tested: 2025-12-02** | **Result: PASSING**

All features verified: Categories list, form fields (name, type, frequency, active, tax deductible, business category), business/personal section separation in dropdowns, edit/delete operations.

---

## 8. Merchants

**Tested: 2025-11-30** | **Result: PASSING**

All features verified: Merchants list with usage counts, form fields, autocomplete in transaction form.

- [!] Usage numbers visible in dropdown - **BUG #96**: Usage numbers should be hidden from user
- [ ] Can create new merchant inline - Not tested (no "create new" option visible)

---

## 9. Savings Goals

**Tested: 2025-12-02** | **Result: PASSING**

All features verified: Goals list, form fields (name, target, date, current amount, priority, category, color), progress tracking, add contribution feature (code verified), edit/delete operations, dashboard widget.

- [ ] Milestone features - Not tested
- [ ] Mark as complete - Not tested

---

## 10. Debts

**Tested: 2025-12-01** | **Result: PASSING**

All features verified: Debts list, collapsible cards, debt form (all fields), payoff timeline, enhanced debt-free countdown (focus debt card, APR, progress, strategy), payoff strategy comparison (snowball/avalanche), rolldown payment visualization.

- [ ] Record payment / Payment history - Not tested
- [ ] What-If Scenario Calculator - Not tested

---

## 11. Reports

**Tested: 2025-11-29** | **Result: PASSING**

All features verified: Summary cards, period selection (6 options), all chart types (Income vs Expenses, Category Pie, Cash Flow, Net Worth, Budget vs Actual, Merchant Spending), account breakdown, debt analysis sections.

- [ ] Report filters (account/category/merchant) - Not tested
- [ ] Experimental charts (Treemap, Heatmap) - Present with EXPERIMENTAL badges
- [ ] Export functionality - Not tested

---

## 12. Tax

**Tested: 2025-12-02** | **Result: PASSING**

All features verified: Tax dashboard, year selector, summary cards, deductions chart, business vs personal filter tabs, tax category mappings (in household settings), PDF export.

### Auto-Classification
- [ ] Creating expense with mapped category creates tax record - Not tested
- [ ] Allocation percentage applied correctly - Not tested

---

## 13. Sales Tax

**Tested: 2025-12-02** | **Result: PASSING**

All features verified: Settings page, multi-level tax rate configuration (state/county/city/special), quarterly reporting with overdue indicators, payment breakdown, charts, compliance checklist.

### Transaction Sales Tax Exemption
- [x] "Subject to sales tax" checkbox on income transactions
- [ ] Exempt transactions show badge on list - NOT TESTED
- [ ] Exempt transactions excluded from quarterly totals - NOT TESTED

### Merchant Sales Tax Exemption
- [x] Tax Exempt column on merchants page with toggle
- [x] Create/Edit merchant dialogs have checkbox
- [x] Merchant selector shows "Tax Exempt" badge
- [x] Transaction form shows indicator when exempt merchant selected
- [ ] Quick Entry Modal - NOT TESTED (experimental features disabled)
- [ ] Backend auto-exemption - NOT TESTED (would require creating transactions)

---

## 14. Rules

**Tested: 2025-11-29** | **Result: PASSING**

All features verified: Rules list, rule builder (all 8 fields, 14 operators, 10 action types), AND/OR logic, create/edit/delete operations, bulk apply section.

- [ ] Reorder priority - NOT TESTABLE (only 1 rule exists)
- [ ] Apply rules to existing transactions - Not tested
- [ ] Rule testing against sample transaction - Not tested

---

## 15. Transfers

**Tested: 2025-12-02** | **Result: PASSING**

All features verified: Transfers list (empty state), new transfer modal (from/to accounts, amount, fees, date, description, notes), convert to transfer modal.

- [ ] Creates two linked transactions - NOT TESTED (would create test data)
- [ ] Transfer suggestions widget - Not tested

---

## 16. CSV Import

**Tested: 2025-11-29** | **Result: PARTIAL PASS**

- [x] Import modal opens with file upload area

### Not Tested (Requires file upload)
- [ ] File upload, CSV preview
- [ ] Import templates (default selection, create/apply)
- [ ] Column mapping (date, description, amount, category, account, type, notes)
- [ ] Import preview, duplicate detection, exclude rows
- [ ] Import execution, success message, error handling, import history

### Phase 12: Credit Card Import Enhancements (2025-12-04)
- [ ] Credit card statement auto-detection from headers
- [ ] Detection confidence badge displayed in settings step
- [ ] Detected issuer name displayed
- [ ] Source type selector (Auto-detect, Bank Account, Credit Card)
- [ ] Card issuer template dropdown (Chase, Amex, Capital One, etc.)
- [ ] Selecting template applies column mappings automatically
- [ ] Transaction type auto-detection (purchase, payment, refund, interest, fee)
- [ ] CC transaction type badges in preview
- [ ] Statement info extraction from header rows (balance, due date, minimum)
- [ ] Statement info card displayed in preview when available
- [ ] Transfer duplicate detection warning in preview
- [ ] Transfer match confidence score displayed
- [ ] New column mapping fields (cc_transaction_type, reference_number, statement info)

---

## 17. Notifications

**Tested: 2025-12-02** | **Result: PASSING**

- [x] Bell icon in sidebar footer opens notifications sheet
- [x] "No notifications yet" empty state with link to /dashboard/notifications
- [!] Console warning about missing aria-describedby for DialogContent

### Notifications List (Not Tested - No notifications exist)
- [ ] All 9 notification types display
- [ ] Mark as read, delete notification

### Notification Preferences
- [x] All 8 types with push/email channels, auto-save working
- [ ] At least one channel required per enabled type - NOT TESTED (validation)

---

## 18. Settings

**Tested: 2025-11-29** | **Result: PASSING**

All Account tabs verified: Profile (avatar, name, email, password), Preferences (currency, date format, number format, default account, week start), Privacy & Security (sessions, timeout, 2FA, OAuth, data export, delete account), Data Management (retention, import preferences, backups, cache, reset), Advanced (developer mode, animations, experimental features, app info, database stats).

All Household tabs verified: Members & Access (member list, roles, invite, rename, delete), Household Preferences (fiscal year), Financial Settings (budget method, period, auto-categorization), Personal Preferences (theme, financial display, notifications).

- [ ] Admin tab (Owner Only) - Not tested

---

## 19. Household Management

**Tested: 2025-12-02** | **Result: PASSING**

- [x] Household switching, create household, data isolation verified

### Not Tested
- [ ] Favorite/star households
- [ ] Join household via invitation (link, accept, decline)
- [ ] Leave household (non-owner only)
- [!] Activity Feed - **NOT VISIBLE** in current Settings UI (no Activity tab)

---

## 20. Navigation & Layout

**Tested: 2025-12-02** | **Result: PASSING**

All features verified: Desktop sidebar (6 sections, collapse/expand, tooltips), mobile hamburger menu, household selector, business features visibility (Tax/Sales Tax pages conditionally shown based on business accounts).

- [ ] Direct URL access to /dashboard/tax without business account - NOT TESTED
- [ ] Direct URL access to /dashboard/sales-tax without business account - NOT TESTED

### User Menu
- [!] No dedicated user menu in current sidebar design - Settings link in Configure section works

---

## 21. Offline Mode

**Tested: 2025-11-30 (Code Review)** | **Result: INFRASTRUCTURE VERIFIED**

Code verified: NetworkStatusProvider, OfflineBanner, IndexedDB request queue (3 retries, auto-sync), offline.html page.

**Note:** Actual network disconnection testing requires manual intervention.

---

## 22. Onboarding

**Tested: 2025-11-30 (Code Review)** | **Result: INFRASTRUCTURE VERIFIED**

Code verified: OnboardingContext (9-10 steps), OnboardingModal with all step components, invited user flow.

**Note:** Testing requires new user account (current test user has completed onboarding).

---

## 23. Developer Mode

**Tested: 2025-12-02** | **Result: PARTIAL PASS**

- [x] Toggle in Advanced settings works immediately
- [x] DEV badge shows in sidebar (expanded and collapsed)
- [x] Dev Tools Panel (user/household info, route, debug export, cache clear)

### Entity ID Badges
- [x] Transactions - TX, Cat, Mer, Acc badges with copy icons
- [x] Bills - Bill and Instance ID badges
- [x] Goals - Goal ID badges
- [x] Debts - Debt ID badges
- [!] Accounts, Categories, Budgets - **NOT IMPLEMENTED**

### Persistence
- [!] **BUG**: Works for client-side navigation only. Does NOT persist across hard page reloads (F5/browser refresh). Server response overwrites localStorage cache.

---

## 24. Experimental Features

**Tested: 2025-11-29** | **Result: PASSING**

All features verified: Toggle in Advanced settings, Quick Entry Mode (Q shortcut, ESC to close), Enhanced Search (regex toggle, save search), Advanced Charts (Treemap, Heatmap with EXPERIMENTAL badges).

- [ ] Quick Entry keyboard shortcuts (Tab, Ctrl+Enter, 1-5, T/Y, N) - NOT TESTED (would create data)

---

## 25. Unified Architecture (Phase 1.1)

**Added: 2025-12-03** | **Result: SCHEMA VERIFIED**

Phase 1.1 implements credit card and line of credit schema enhancements. This is a schema-only change; UI updates come in later phases.

### Schema Changes Applied
- [x] `accounts` table: Added 16 new fields for credit card/line of credit support
  - Statement tracking: `statement_balance`, `statement_date`, `statement_due_date`, `minimum_payment_amount`, `last_statement_updated`
  - Interest: `interest_rate`, `minimum_payment_percent`, `minimum_payment_floor`, `additional_monthly_payment`
  - Line of credit: `is_secured`, `secured_asset`, `draw_period_end_date`, `repayment_period_end_date`, `interest_type`, `prime_rate_margin`
  - Annual fee: `annual_fee`, `annual_fee_month`, `annual_fee_bill_id`
  - Strategy: `auto_create_payment_bill`, `include_in_payoff_strategy`
- [x] `accounts` table: Added `line_of_credit` to type enum
- [x] `credit_limit_history` table: Created for tracking limit changes
- [x] `account_balance_history` table: Created for utilization trends

### Database Verification
- [x] Migration `0057_add_credit_card_fields.sql` applied successfully
- [x] All 16 new columns present on `accounts` table
- [x] `credit_limit_history` table exists with proper schema
- [x] `account_balance_history` table exists with proper schema
- [x] All indexes created

### UI Testing (Deferred to Phase 2+)
- [ ] Account form shows credit card fields when type=credit
- [ ] Account form shows line of credit fields when type=line_of_credit
- [ ] Credit utilization displays correctly
- [ ] Balance history chart

---

## Test Environment Checklist

Before testing, verify:
- [ ] Fresh database or known test data state
- [ ] All environment variables set
- [ ] Development server running (`pnpm dev`)
- [ ] Browser dev tools open for error monitoring

---

## Bug Reporting

Document issues in `docs/bugs.md` with: Bug Title, Steps to Reproduce, Expected/Actual Behavior, Environment, Screenshots.

---

## 26. Unified Architecture (Phase 1.2)

**Added: 2025-12-03** | **Result: SCHEMA VERIFIED**

Phase 1.2 Bills Enhancement - schema changes applied, build verified.

### Bills Table Schema
- [x] `bill_type` column added (expense/income/savings_transfer)
- [x] `bill_classification` column added (subscription/utility/housing/etc.)
- [x] `classification_subcategory` column added
- [x] `linked_account_id` column added (for credit card payment bills)
- [x] `amount_source` column added (fixed/minimum_payment/statement_balance/full_balance)
- [x] `charged_to_account_id` column added (for subscriptions charged to card)
- [x] Autopay columns: `is_autopay_enabled`, `autopay_account_id`, `autopay_amount_type`, `autopay_fixed_amount`, `autopay_days_before`
- [x] Debt extension columns: `is_debt`, `original_balance`, `remaining_balance`, `bill_interest_rate`, `interest_type`, `minimum_payment`, `bill_additional_monthly_payment`, `debt_type`, `bill_color`
- [x] Strategy columns: `include_in_payoff_strategy`
- [x] Tax columns: `is_interest_tax_deductible`, `tax_deduction_type`, `tax_deduction_limit`
- [x] All indexes created

### Schema Integration
- [x] `lib/db/schema.ts` updated with new fields
- [x] Application builds without errors
- [x] Existing bills retain default values

---

## 27. Unified Architecture (Phase 1.3)

**Added: 2025-12-03** | **Result: SCHEMA VERIFIED**

Phase 1.3 Bill Instances & Payments - schema changes applied, build verified.

### Bill Instances Table Enhancements
- [x] `paid_amount` column added (tracks partial payments)
- [x] `remaining_amount` column added (amount still owed)
- [x] `payment_status` column added (unpaid/partial/paid/overpaid)
- [x] `principal_paid` column added (for debt bills)
- [x] `interest_paid` column added (for debt bills)
- [x] Payment status index created

### New Tables
- [x] `bill_payments` table created (tracks individual payments toward bill instances)
  - Columns: id, bill_id, bill_instance_id, transaction_id, user_id, household_id, amount, principal_amount, interest_amount, payment_date, payment_method, linked_account_id, balance_before_payment, balance_after_payment, notes, created_at
  - All indexes created
- [x] `bill_milestones` table created (tracks payoff milestones for debt bills and credit accounts)
  - Columns: id, bill_id, account_id, user_id, household_id, percentage, milestone_balance, achieved_at, notification_sent_at, created_at
  - All indexes created

### Schema Integration
- [x] `lib/db/schema.ts` updated with new fields and tables
- [x] Application builds without errors

---

## 28. Unified Architecture (Phase 1.4)

**Added: 2025-12-03** | **Result: SCHEMA VERIFIED**

Phase 1.4 Categories & Household Settings - schema changes applied, build verified.

### Budget Categories Table Enhancements
- [x] `is_system_category` column added (for auto-created categories)
- [x] `is_interest_category` column added (for interest expense categories)
- [x] `rollover_enabled` column added (enable budget rollover)
- [x] `rollover_balance` column added (current rollover amount)
- [x] `rollover_limit` column added (max rollover cap, null = unlimited)
- [x] System category and rollover indexes created

### Household Settings Table Enhancements
- [x] `debt_strategy_enabled` column added (enable debt payoff strategy)
- [x] `debt_payoff_method` column added (snowball/avalanche)
- [x] `extra_monthly_payment` column added (additional debt payment)
- [x] `payment_frequency` column added (weekly/biweekly/monthly)

### Schema Integration
- [x] `lib/db/schema.ts` updated with new fields
- [x] Application builds without errors

### Note
Category type simplification (6 types to 3) is deferred to avoid breaking existing code.

---

## 29. Unified Architecture (Phase 1.5)

**Added: 2025-12-03** | **Result: SCHEMA VERIFIED**

Phase 1.5 Transactions Enhancement - schema changes applied, build verified.

### Transactions Table Enhancements
- [x] `savings_goal_id` column added (link transactions to savings goals)
- [x] Savings goal index created

### Schema Integration
- [x] `lib/db/schema.ts` updated with new field
- [x] Application builds without errors

### Note
Debt-to-bill data migration and legacy table cleanup are deferred to a separate phase for careful testing.

---

## 30. Unified Architecture (Phase 2)

**Tested: 2025-12-08** | **Result: UI VERIFIED**

Phase 2 Account Creation Flow - UI and API updates for credit card and line of credit accounts.

### Account Form Updates
- [x] Account type dropdown includes "Line of Credit" option
- [x] Credit card type shows Credit Card Details section
- [x] Line of Credit type shows Line of Credit Details section
- [x] APR field accepts 0-100% values
- [x] Payment Due Day field accepts 1-31
- [x] Minimum Payment % field works
- [x] Minimum Payment Floor ($) field works
- [x] Annual Fee field works
- [x] Fee Month dropdown populates correctly

### Credit Card Specific
- [x] Credit Limit field displays for credit cards
- [x] Amount Owed label changes from "Current Balance"
- [x] Annual Fee fields show for credit cards

### Line of Credit Specific
- [x] Interest Type toggle (Fixed/Variable) works
- [x] Prime + margin field shows for Variable rate
- [x] Secured toggle shows asset description field
- [x] Draw Period End Date picker works
- [x] Repayment Period End Date picker works

### Payment Tracking Section
- [x] "Set up monthly payment tracking" toggle defaults to ON (observed in form)
- [x] Payment Amount Source dropdown (Statement Balance, Minimum Payment, Full Balance) - dropdown visible with "Statement Balance" default
- [x] "Include in debt payoff strategy" toggle defaults to ON (observed in form)
- [ ] Tooltips display helpful information - NOT TESTED

### Auto-Bill Creation
- [x] Creating credit card with payment tracking ON creates linked payment bill ("Test Chase Sapphire Payment" created automatically)
- [x] Payment bill appears on Dashboard widgets (This Month's Bills, Next Payments)
- [x] Bill has correct due day (Dec 14, matches payment due day 15)
- [ ] Bill has correct amount source type - NOT VERIFIED (shows $0.00)
- [ ] Creating credit card with annual fee creates annual fee bill - NOT TESTED (no annual fee set)
- [ ] Annual fee bill has correct month and amount - NOT TESTED

### Credit Limit History
- [ ] Creating credit card with credit limit creates initial history record
- [ ] Editing credit limit creates change history record
- [ ] History shows correct change reason

### API Verification
- [ ] POST /api/accounts accepts all new credit fields
- [ ] POST creates payment bill when autoCreatePaymentBill is true
- [ ] POST creates annual fee bill when annualFee > 0
- [ ] POST creates credit limit history when creditLimit set
- [ ] PUT /api/accounts/[id] updates all credit fields
- [ ] PUT tracks credit limit changes in history
- [ ] PUT handles payment tracking toggle changes

---

## 31. Unified Architecture (Phase 3)

**Tested: 2025-12-09** | **Result: UI VERIFIED**

Phase 3 Bill Form Updates - Enhanced bill form with debt, autopay, and credit card linking features. Autopay configuration fully verified.

### Bill Classification
- [x] Bill Classification dropdown shows 8 options (Subscription, Utility, Housing, Insurance, Loan Payment, Membership, Service, Other)
- [ ] Classification saves correctly to database - NOT TESTED
- [ ] Classification loads correctly when editing bill - NOT TESTED

### Credit Card Linking Section (only shows when credit accounts exist)
- [ ] "Linked Credit Card/LOC" section appears when credit accounts exist
- [ ] Dropdown shows only credit and line_of_credit accounts
- [ ] Selecting linked account shows Amount Source dropdown
- [ ] Amount Source options: Fixed, Minimum Payment, Statement Balance, Full Balance
- [ ] Info box shows when linked account selected
- [ ] "Charged to Credit Card" section shows when NO linked account selected
- [ ] Cannot select both linkedAccountId AND chargedToAccountId (mutually exclusive)

### Autopay Configuration
- [x] Autopay toggle expands configuration section - VERIFIED (toggle clicks expand full config panel)
- [x] Pay From Account dropdown shows all accounts - VERIFIED ("Select account..." dropdown)
- [x] Amount dropdown defaults to "Fixed Amount" - VERIFIED
- [ ] Amount dropdown shows credit-specific options when linkedAccountId is set - NOT TESTED
- [x] Fixed Amount input appears when amount type is "fixed" - VERIFIED ("0.00" input field)
- [x] Days Before Due dropdown shows 0, 1, 2, 3, 5, 7, 14 options - VERIFIED (On due date, 1-14 day options)
- [x] Warning message displays about automatic transactions - VERIFIED ("Autopay will create transactions automatically. Ensure sufficient funds are available in the source account.")
- [ ] Validation: autopayAccountId required when autopay enabled - NOT TESTED (would require form submission)

### Debt Configuration
- [ ] "This is a debt" toggle expands debt section
- [ ] Original Balance field (required when isDebt=true)
- [ ] Remaining Balance field (defaults to original if not set)
- [ ] Interest Rate (APR %) field
- [ ] Compounding dropdown (Daily, Monthly, Annually)
- [ ] Debt Start Date picker
- [ ] Color picker with 8 color options
- [ ] "Include in payoff strategy" toggle (defaults ON)
- [ ] Validation: originalBalance required when isDebt=true

### Tax Deduction Settings (inside debt section)
- [ ] "Interest is tax deductible" toggle
- [ ] Deduction Type dropdown appears when enabled (None, Mortgage, Student Loan, Business, HELOC/Home Equity)
- [ ] Annual Limit input field appears when enabled
- [ ] All settings save correctly

### Form Validation
- [ ] Cannot submit with linkedAccountId AND chargedToAccountId both set
- [ ] Cannot submit debt bill without original balance
- [ ] Cannot enable autopay without selecting source account

### API Integration
- [ ] POST /api/bills accepts all new fields
- [ ] PUT /api/bills/[id] updates all new fields
- [ ] Validation returns proper error messages
- [ ] Account ID references validated for household membership

### Save & Add Another
- [ ] All new fields reset properly after save & add another
- [ ] Debt, autopay, and advanced sections collapse after reset

---

## 32. Unified Architecture (Phase 4)

**Tested: 2025-12-08** | **Result: VERIFIED**

Phase 4 implements display updates for credit accounts and unified debt views.

### Accounts Page - Grouped View
- [x] Accounts grouped by type (Cash & Debit vs Credit)
- [x] Section headers show group totals ("Cash & Debit Accounts" / "Credit Accounts" with totals)
- [x] Cash section shows: Checking, Savings, Cash, Investment accounts
- [x] Credit section shows: Credit Cards, Lines of Credit
- [x] Summary cards show: Net Worth, Cash Balance, Credit Used, Available Credit
- [ ] Empty sections hidden gracefully - NOT TESTED

### Account Card Enhancements
- [x] Credit cards show APR (19.99% displayed correctly)
- [ ] Credit cards show utilization bar with color coding - NOT VISIBLE (may need more balance history)
- [ ] Lines of credit show draw period status - NOT TESTED (no LOC created)
- [ ] Overpayment (negative balance) shows as "Credit Balance" in green - NOT TESTED
- [x] Strategy inclusion status displayed ("Included" / "Excluded")

### Dashboard Stats
- [x] Cash Balance stat shows only checking/savings/cash/investment
- [x] Credit Used stat appears only when credit accounts exist
- [ ] Credit Used tooltip shows available credit - NOT TESTED (tooltip)

### Debts Page - Unified View
- [x] View mode toggle (Unified View / Debt Bills Only)
- [x] Unified view shows credit accounts + debt bills together
- [x] Filter tabs: All, Credit Cards, Lines of Credit, Loans
- [x] Summary stats show combined totals
- [x] Strategy inclusion count displayed ("1 of 1 In Strategy")
- [x] UnifiedDebtCard shows source indicator ("Credit Card" type label)

### Utilization Trends Chart (via "Show Trends" button on Accounts page)
- [x] Chart appears when Show Trends clicked
- [x] Time range selector (30/60/90 days)
- [x] Reference lines at Good (30%) and High (80%) thresholds
- [ ] Gradient color based on current utilization - hard to verify with limited data
- [ ] Tooltip shows date, utilization %, balance, and limit - NOT TESTED
- [x] Legend explains color zones (0-30% Excellent, 30-80% Fair, 80%+ High)

### Balance History Chart
- [x] Chart shows credit accounts
- [ ] Individual view toggle (when multiple accounts) - N/A (only 1 account)
- [ ] Each account has distinct color - N/A (only 1 account)
- [ ] Tooltip shows breakdown by account - NOT TESTED
- [x] Current balances shown in footer legend ("Test Chase Sapphire: $2,500")

### API Endpoints
- [ ] GET /api/debts/unified returns combined credit accounts and debt bills - NOT TESTED
- [ ] GET /api/accounts/utilization-history returns historical utilization data - NOT TESTED
- [ ] GET /api/accounts/balance-history returns historical balance data - NOT TESTED
- [ ] All endpoints filter by household correctly - NOT TESTED

---

## 33. Unified Architecture (Phase 5)

**Tested: 2025-12-08** | **Result: UI VERIFICATION NEEDED**

Phase 5 implements transaction flow updates for credit card payments and bill payment tracking.

### Credit Card Payments via Transfer
- [!] Transfer TO credit card auto-detects linked payment bill - **NO UI BANNER VISIBLE** when selecting credit card as destination in transfer form. Detection may be backend-only on save.
- [ ] Payment within 7-day tolerance matches bill instance
- [ ] Bill instance status updates to 'paid' on full payment
- [ ] Bill instance status updates to 'partial' on partial payment
- [ ] Bill payment record created in `bill_payments` table
- [ ] Credit card balance decreases correctly after payment
- [ ] Balance transfers (credit-to-credit) skip bill marking

### Partial Payment Handling
- [ ] Partial payment updates `paidAmount` on bill instance
- [ ] `remainingAmount` calculated correctly
- [ ] `paymentStatus` shows 'partial' for incomplete payments
- [ ] Multiple partial payments accumulate correctly
- [ ] Full payment after partial marks instance as 'paid'
- [ ] Overpayment marks instance as 'overpaid'

### Payment History Recording
- [ ] All bill payments create `bill_payments` records
- [ ] Records include principal/interest breakdown for debt bills
- [ ] Records link to source transaction
- [ ] GET /api/bills/[id]/payments returns payment history
- [ ] GET /api/bills/instances/[id]/payments returns instance payments
- [ ] Payment summary includes totals and breakdown

### Balance Transfers (Credit-to-Credit)
- [ ] Transfer between two credit accounts sets `isBalanceTransfer=true`
- [ ] Both transfer_out and transfer_in transactions marked
- [ ] Balance transfers do NOT auto-mark bill instances
- [ ] Source credit card balance decreases (debt reduced)
- [ ] Destination credit card balance increases (debt increased)

### Credit Card Refunds
- [ ] Income on credit account sets `isRefund=true`
- [ ] Refund correctly reduces credit card balance
- [ ] Refunds do NOT auto-mark bill instances

### chargedToAccountId Auto-Matching
- [ ] Expenses match bills with `chargedToAccountId` = expense account
- [ ] Description similarity (Levenshtein) contributes 40% to match score
- [ ] Amount within tolerance contributes 30% to match score
- [ ] Date proximity (±3 days) contributes 30% to match score
- [ ] Only matches with confidence >= 85% are auto-linked

### Database Schema
- [ ] `is_balance_transfer` column added to transactions
- [ ] `is_refund` column added to transactions
- [ ] Migration 0044 applied successfully
- [ ] Indexes created for new columns

### Remaining (Deferred)
- [ ] Legacy debt linking deprecation (gradual migration)

---

## 34. Unified Architecture (Phase 6)

**Tested: 2025-12-09** | **Result: UI VERIFIED / BACKEND NOT TESTED**

Phase 6 implements the Autopay System for automatic bill payments. UI configuration verified in bill form (Section 31). Backend cron job testing requires manual execution.

### Autopay Amount Calculator (`lib/bills/autopay-calculator.ts`)
- [ ] Fixed amount returns configured `autopayFixedAmount`
- [ ] Minimum payment pulls from linked credit account's `minimumPaymentAmount`
- [ ] Statement balance uses linked account's `statementBalance`
- [ ] Full balance uses absolute value of credit account's `currentBalance`
- [ ] Falls back to expected amount when account data unavailable
- [ ] Zero/negative amounts return "Nothing Owed" status
- [ ] Insufficient funds detection works correctly

### Autopay Transaction Creator (`lib/bills/autopay-transaction.ts`)
- [ ] Creates transfer for credit card payments (linkedAccountId set)
- [ ] Creates expense for regular bills (no linkedAccountId)
- [ ] Updates source account balance correctly (decreases)
- [ ] Updates credit account balance correctly (reduces debt)
- [ ] Calls `processBillPayment()` to update bill instance
- [ ] Returns error for already-paid instances
- [ ] Returns error for invalid autopay configuration
- [ ] Returns error for insufficient funds

### Autopay Processor (`lib/bills/autopay-processor.ts`)
- [ ] Finds all autopay-enabled, active bills
- [ ] Filters instances by due date and `autopayDaysBefore`
- [ ] Only processes pending/overdue instances
- [ ] Skips bills without `autopayAccountId`
- [ ] Processes multiple bills across different users
- [ ] Returns accurate success/failure/skipped counts
- [ ] Handles errors gracefully without stopping other bills

### Cron Job Endpoint (`app/api/cron/autopay/route.ts`)
- [ ] POST processes all autopay bills
- [ ] GET returns preview of bills due today
- [ ] Cron secret validation works in production mode
- [ ] Returns detailed result with successes and errors

### Autopay Notifications (`lib/notifications/autopay-notifications.ts`)
- [ ] Success notification created with correct amount and details
- [ ] Failure notification created with error message
- [ ] Priority levels appropriate (low for success, high for failure)
- [ ] Metadata includes bill and transaction references

### Bill Reminder Suppression (`lib/notifications/bill-reminders.ts`)
- [ ] Autopay-enabled bills skip due reminders
- [ ] Non-autopay bills still receive reminders
- [ ] `skippedAutopay` count returned in result

---

## 35. Unified Architecture (Phase 7)

**Tested: 2025-12-08** | **Result: UI VERIFIED**

Phase 7 implements budget integration with debt payoff strategy.

### Debt Strategy Toggle in Settings
- [x] Household Financial Settings shows "Debt Payoff Strategy" section - VERIFIED in Settings > Households > Financial Settings
- [x] Toggle enables/disables strategy mode - "Use Debt Payoff Strategy" switch visible (checked)
- [x] Payoff Method dropdown (Avalanche/Snowball) appears when enabled - Shows "Avalanche (Highest Interest First)"
- [x] Extra Monthly Payment input works - Shows $100 entered
- [x] Payment Frequency dropdown works - Shows "Monthly"
- [ ] Settings save correctly to household settings table - NOT TESTED (would require changing settings)

### Budget Page - Strategy Mode (debtStrategyEnabled=true)
- [ ] Debt section shows "Managed by Strategy" header with method name
- [ ] Focus debt highlighted with star icon
- [ ] Extra payment amount displayed on focus debt
- [ ] All strategy debts shown with recommended payments (read-only)
- [ ] Excluded debts shown in separate "Manual" section (editable)
- [ ] Total calculated from strategy + manual debts

### Budget Page - Manual Mode (debtStrategyEnabled=false)
- [ ] All debts shown as individual editable lines
- [ ] Each debt shows minimum payment reference
- [ ] Custom budgeted payment amounts can be entered
- [ ] "Enable Payoff Strategy" link shown
- [ ] Total calculated from all custom amounts

### Budget Manager Modal
- [ ] Strategy debts section shows when strategy enabled (read-only)
- [ ] Manual/excluded debts section shows as editable inputs
- [ ] Manual mode shows all debts as editable
- [ ] Debt budget amounts save correctly to accounts/bills tables
- [ ] Summary totals include debt payments
- [ ] Links to Debts page and Strategy Settings work

### API Endpoints
- [ ] GET /api/budgets/debts-unified returns correct structure
- [ ] Response includes strategyEnabled, payoffMethod, extraMonthlyPayment
- [ ] strategyDebts items have isFocusDebt flag set correctly
- [ ] manualDebts populated correctly based on includeInPayoffStrategy
- [ ] Actual payments calculated from transactions correctly
- [ ] PUT /api/accounts/[id] accepts budgetedMonthlyPayment
- [ ] PUT /api/bills/[id] accepts budgetedMonthlyPayment

### Database
- [ ] budgeted_monthly_payment column exists on accounts table
- [ ] budgeted_monthly_payment column exists on bills table
- [ ] Migration 0065 applied successfully

---

## 36. Unified Architecture (Phase 8)

**Tested: 2025-12-08** | **Result: UI VERIFIED**

Phase 8 implements payoff strategy updates to use unified debt sources and per-debt inclusion toggles.

### Payoff Strategy API Updates
- [ ] GET /api/debts/payoff-strategy uses unified sources (accounts + bills) - NOT TESTED
- [ ] Response includes `source` and `sourceType` for each debt - NOT TESTED
- [ ] Response includes `excludedDebts` section - NOT TESTED
- [ ] `inStrategyOnly` query param filters correctly - NOT TESTED
- [ ] Uses householdSettings for strategy configuration - NOT TESTED
- [ ] Falls back to debtSettings for backward compatibility - NOT TESTED

### Strategy Toggle API
- [x] POST /api/debts/strategy-toggle validates source (account/bill) - VERIFIED via UI toggle
- [x] Toggle updates account `includeInPayoffStrategy` correctly - "In Strategy" button toggles to "Excluded", summary updates from "1 of 1" to "0 of 1"
- [ ] Toggle updates bill `includeInPayoffStrategy` correctly - NOT TESTED (no debt bills)
- [ ] Returns error for non-credit accounts - NOT TESTED
- [ ] Returns error for non-debt bills - NOT TESTED
- [ ] Returns updated debt in unified format - NOT TESTED

### Settings Migration
- [ ] GET /api/debts/settings reads from householdSettings first
- [ ] Falls back to legacy debtSettings if householdSettings missing
- [ ] Returns `debtStrategyEnabled` field
- [ ] PUT /api/debts/settings updates both householdSettings and debtSettings
- [ ] Creates settings if none exist

### Stats API Updates
- [ ] GET /api/debts/stats uses unified mode by default
- [ ] Response includes `inStrategyCount` and `inStrategyBalance`
- [ ] Response includes `creditAccountCount` and `debtBillCount`
- [ ] `?unified=false` uses legacy debts table

### Debts Page UI
- [x] Strategy toggle button works on UnifiedDebtCard - "In Strategy" button visible and clickable
- [x] Toggling updates local state optimistically - UI updates immediately when clicking
- [ ] Toast shows success/error message - NOT OBSERVED (may appear briefly)
- [x] Summary stats update on toggle - "In Strategy" count changes from "1 of 1" to "0 of 1" and back
- [x] Strategy refresh triggered after toggle - Debt-Free Countdown updates (shows "0 months" when excluded, "33 months" when included)

### Visual Indicators
- [x] Debts in strategy show green "In Strategy" badge - Verified with checkmark icon
- [x] Excluded debts show gray "Excluded" badge - Verified with different icon
- [ ] Excluded debt cards have reduced opacity - NOT OBSERVED (cards look same)

---

## 37. Unified Architecture (Phase 9)

**Tested: 2025-12-08** | **Result: PARTIALLY VERIFIED**

Phase 9 implements calendar integration with the unified debt architecture.

### Bill Due Dates on Calendar
- [x] Credit card payment bills show with credit card icon (verified with Test Chase Sapphire Payment)
- [x] Bills with linkedAccountName show linked account info ("for Test Chase Sapphire")
- [x] Bill tooltip shows linked account name (visible on day cell)
- [ ] Overdue bills appear first in day cell - NOT TESTED (no overdue bills in test data)

### Autopay Processing Dates on Calendar
- [ ] Autopay events show on date = dueDate - autopayDaysBefore - NOT TESTED (no autopay enabled)
- [ ] Autopay indicator uses Clock icon - NOT TESTED
- [ ] Autopay tooltip shows bill name, amount, source account - NOT TESTED
- [ ] Autopay shows "To: [Account]" for credit card payments - NOT TESTED
- [ ] Day modal shows Scheduled Autopay section with full details - NOT TESTED
- [ ] Amount type label displays correctly (Fixed, Minimum, etc.) - NOT TESTED

### Projected Payoff Dates on Calendar
- [ ] Credit accounts with balance > 0 show projected payoff date - NOT TESTED (need credit account in strategy)
- [ ] Debt bills with remainingBalance > 0 show projected payoff date - NOT TESTED
- [ ] Payoff date calculated as: balance / monthlyPayment months from now - NOT TESTED
- [ ] Payoff date uses TrendingDown icon - NOT TESTED
- [ ] Color matches debt/account color - NOT TESTED
- [ ] Day modal shows Projected Payoff Dates section - NOT TESTED
- [ ] "Debt Free!" message displays with 100% progress bar - NOT TESTED

### Bill Milestones on Calendar
- [ ] Achieved milestones from billMilestones table appear on calendar - NOT TESTED (no milestones)
- [ ] Milestones show Trophy icon - NOT TESTED
- [ ] Milestone percentage displayed (25%, 50%, 75%, 100%) - NOT TESTED
- [ ] Day modal shows Payoff Milestones section with details - NOT TESTED
- [ ] Milestone balance shown in modal - NOT TESTED
- [ ] Source type displayed (Credit Account / Loan) - NOT TESTED

### Day Cell Display Priority
- [ ] Overdue bills shown first (red) - NOT TESTED
- [x] Pending bills shown (orange/yellow) - Verified "pending" status badge in day modal
- [ ] Autopay events shown (primary color) - NOT TESTED
- [ ] Goals shown (goal color) - NOT TESTED
- [ ] Payoff dates shown (debt color) - NOT TESTED
- [ ] Bill milestones shown (success color) - NOT TESTED
- [ ] Transaction indicators at bottom - NOT TESTED (no transactions)

### API Responses
- [x] GET /api/calendar/month includes autopayEvents, payoffDates, billMilestones
- [x] GET /api/calendar/day includes detailed autopay, payoff, and milestone data
- [x] Summary counts include autopayCount, payoffDateCount, billMilestoneCount
- [x] Bill objects include isDebt, isAutopayEnabled, linkedAccountName

---

## 48. Calendar Sync (External)

**Added: 2025-12-07** | **Result: NEEDS TESTING**

External calendar sync for syncing bills, milestones, and payoff dates to Google Calendar and TickTick.

### Google Calendar Integration
- [ ] Connect button initiates OAuth flow
- [ ] OAuth callback creates calendar connection
- [ ] Primary calendar auto-selected on connect
- [ ] Calendar selector dialog shows user's calendars
- [ ] Changing calendar updates connection
- [ ] Disconnect button removes connection and optionally deletes remote events
- [ ] Connection status displays correctly (connected/not connected)

### TickTick Integration
- [ ] Connect button initiates OAuth flow
- [ ] OAuth callback creates connection and auto-creates "Unified Ledger" project
- [ ] Project selector dialog shows user's projects
- [ ] Changing project updates connection
- [ ] Disconnect button removes connection
- [ ] Connection status displays correctly

### Sync Settings
- [ ] Sync Mode selector (Direct dates vs Budget periods)
- [ ] What to Sync toggles (Bills, Milestones, Goals, Payoff Dates)
- [ ] Reminder timing selector works
- [ ] Settings auto-save on change
- [ ] Manual "Sync Now" button triggers full sync
- [ ] Last synced timestamp updates after sync

### Sync Behavior
- [ ] Bills create calendar events/tasks on due dates
- [ ] Milestones create events on projected achievement dates
- [ ] Payoff dates create events
- [ ] Budget period mode groups events by pay period start
- [ ] Events include deep links back to app
- [ ] Reminders set according to user preference
- [ ] Auto-sync triggers when source data changes

### Environment Variables
- [ ] GOOGLE_CALENDAR_CLIENT_ID required for Google
- [ ] GOOGLE_CALENDAR_CLIENT_SECRET required for Google
- [ ] TICKTICK_CLIENT_ID required for TickTick
- [ ] TICKTICK_CLIENT_SECRET required for TickTick
- [ ] Missing credentials show appropriate error message

---

## Testing Summary

| Section | Status | Notes |
|---------|--------|-------|
| 1. Dashboard | PASSING | Collapse persistence missing |
| 2. Transactions | PASSING | Templates, splits save untested |
| 3. Accounts | PASSING | All features verified |
| 4. Bills | PASSING | Auto-detection untested |
| 5. Budgets | PASSING | Templates, export untested |
| 6. Calendar | PASSING | Debt milestones need test data |
| 7. Categories | PASSING | All features verified |
| 8. Merchants | PASSING | Usage numbers bug |
| 9. Goals | PASSING | Milestones untested |
| 10. Debts | PASSING | Payments, scenarios untested |
| 11. Reports | PASSING | Filters, export untested |
| 12. Tax | PASSING | Auto-classification untested |
| 13. Sales Tax | PASSING | Backend exemption untested |
| 14. Rules | PASSING | Bulk apply untested |
| 15. Transfers | PASSING | Linked transactions untested |
| 16. CSV Import | PARTIAL | File upload required |
| 17. Notifications | PASSING | No notifications to test |
| 18. Settings | PASSING | Admin tab untested |
| 19. Household | PASSING | Invitations untested |
| 20. Navigation | PASSING | All verified |
| 21. Offline | CODE VERIFIED | Manual network test needed |
| 22. Onboarding | CODE VERIFIED | New user test needed |
| 23. Developer Mode | PARTIAL | Persistence bug |
| 24. Experimental | PASSING | All features verified |
| 25. Unified Architecture (1.1) | SCHEMA VERIFIED | Phase 1.1 schema applied |
| 26. Unified Architecture (1.2) | SCHEMA VERIFIED | Phase 1.2 schema applied |
| 27. Unified Architecture (1.3) | SCHEMA VERIFIED | Phase 1.3 schema applied |
| 28. Unified Architecture (1.4) | SCHEMA VERIFIED | Phase 1.4 schema applied |
| 29. Unified Architecture (1.5) | SCHEMA VERIFIED | Phase 1.5 schema applied |
| 30. Unified Architecture (Phase 2) | UI VERIFIED | Account/Credit Card/LOC form fields working |
| 31. Unified Architecture (Phase 3) | UI VERIFIED | Bill form - Classification, Autopay config fully verified |
| 32. Unified Architecture (Phase 4) | VERIFIED | Accounts grouped view, dashboard stats, debts unified view, trends charts |
| 33. Unified Architecture (Phase 5) | PARTIALLY VERIFIED | No UI detection banner when transferring to credit card |
| 34. Unified Architecture (Phase 6) | UI VERIFIED | Autopay form config verified, backend cron not tested |
| 35. Unified Architecture (Phase 7) | UI VERIFIED | Debt strategy settings all working (toggle, method, extra payment, frequency) |
| 36. Unified Architecture (Phase 8) | UI VERIFIED | Per-debt inclusion toggle works, summary stats update correctly |
| 37. Unified Architecture (Phase 9) | PARTIALLY VERIFIED | Calendar - Bills show linked account, API includes Phase 9 fields |
| 38. Unified Architecture (Phase 10) | CODE COMPLETE | Notifications system |
| 39. Unified Architecture (Phase 11) | CODE COMPLETE | Tax integration |
| 40. Unified Architecture (Phase 12) | CODE COMPLETE | CSV import enhancements |
| 41. Unified Architecture (Phase 13) | PARTIALLY VERIFIED | Dashboard widgets - Stats, utilization working. BUG: next7DaysCount off-by-one |
| 42. Unified Architecture (Phase 14) | UI VERIFIED | Utilization, Balance History, and Interest Paid charts working in Debts page Trends section |
| 43. Unified Architecture (Phase 15) | CODE COMPLETE | Category simplification |
| 44. Unified Architecture (Phase 16) | PARTIALLY VERIFIED | Recurring income - Type filters working, income labels verified |
| 45. Unified Architecture (Phase 17) | UI VERIFIED | Rollover Summary UI working (toggle, limit editor, info banner) |
| 46. Unified Architecture (Phase 18) | CODE COMPLETE | Savings-goals integration with auto-detection, savings rate tracking, contribution history |
| 47. Unified Architecture (Phase 19) | VERIFIED | Auto-suggestion working (Netflix->Subscription confirmed), suggestion UI with Apply button |
| 48. Calendar Sync (External) | CODE COMPLETE | Google Calendar and TickTick sync |

**Overall: 34/48 browser-tested, 14/48 code/schema-reviewed**

**Last Comprehensive Test:** 2025-12-09
**Test Environment:** Chrome via Playwright, macOS, localhost:3000, TEST_MODE=true

---

## 38. Unified Architecture (Phase 10)

**Added: 2025-12-04** | **Result: CODE COMPLETE**

Phase 10 implements notification enhancements for the unified debt architecture.

### High Utilization Alerts
- [ ] Setting toggle in Notifications tab works
- [ ] Threshold dropdown (30%, 50%, 75%, 90%) saves correctly
- [ ] Notifications created when utilization exceeds threshold
- [ ] No duplicate notifications for same threshold crossing
- [ ] Notification resets when utilization drops below threshold
- [ ] Alert state tracked in utilizationAlertState table

### Credit Limit Change Notifications
- [ ] Setting toggle in Notifications tab works
- [ ] Channel selector saves correctly
- [ ] Notification created when credit limit increases
- [ ] Notification created when credit limit decreases
- [ ] Notification shows utilization impact
- [ ] Initial limit setting (account creation) does not notify

### Unified Debt Milestones
- [ ] Milestones checked for credit accounts (type=credit, line_of_credit)
- [ ] Milestones checked for debt bills (isDebt=true)
- [ ] Notifications created at 25%, 50%, 75%, 100% milestones
- [ ] Milestone state tracked in billMilestones table
- [ ] No duplicate notifications for same milestone
- [ ] Special "Debt Paid Off" message at 100%

### Notification Settings UI
- [ ] Credit Utilization Alerts card displays correctly
- [ ] All toggles and selectors accessible
- [ ] Channel selectors work for both notification types
- [ ] Settings save via API correctly
- [ ] UI shows loading state during save

### API Endpoints
- [ ] GET /api/notifications/utilization-alerts checks current user's household
- [ ] POST /api/notifications/utilization-alerts processes all households (cron)
- [ ] GET /api/notifications/debt-milestones returns stats in unified mode
- [ ] POST /api/notifications/debt-milestones creates notifications for unified sources

### Database Schema
- [ ] userHouseholdPreferences has highUtilization* columns
- [ ] userHouseholdPreferences has creditLimitChange* columns
- [ ] utilizationAlertState table created with threshold tracking
- [ ] All indexes created

---

## 39. Unified Architecture (Phase 11)

**Added: 2025-12-04** | **Result: CODE COMPLETE**

Phase 11 implements tax integration for debt bill interest deductions.

### Interest Deduction Classification
- [ ] Interest from tax-deductible debt bills auto-classified on payment
- [ ] Classification respects bill's `taxDeductionType` setting
- [ ] Classification respects bill's `taxDeductionLimit` if set
- [ ] Student loan interest respects $2,500 annual limit
- [ ] Mortgage interest tracked (no annual dollar limit)
- [ ] Business interest tracked (no annual limit)
- [ ] HELOC interest tracked (no annual limit)

### Tax Dashboard Interest Section
- [ ] Interest Deductions card displays when interest payments exist
- [ ] Shows summary by type (mortgage, student loan, business, HELOC)
- [ ] Progress bars show percentage of annual limit used
- [ ] Warning colors at 80% (approaching) and 100% (reached)
- [ ] Totals section shows total paid, deductible, and limited amounts
- [ ] Data fetches correctly with year filter

### Limit Warnings
- [ ] Notification created when annual limit approaches (80%)
- [ ] Notification created when annual limit reached (100%)
- [ ] No duplicate notifications within 7 days
- [ ] Notification links to Tax Dashboard
- [ ] Warning message includes limit amount and percentage

### API Endpoints
- [ ] GET /api/tax/interest-deductions returns summary by type
- [ ] GET /api/tax/interest-deductions returns limit statuses
- [ ] Optional includePayments query param returns payment details

### Database Schema
- [ ] interest_deductions table created
- [ ] All indexes created (user, household, year, type, bill, payment)
- [ ] Proper foreign keys to bills and bill_payments
- [ ] Tax categories include "HELOC/Home Equity Interest" and "Business Interest Expense"

---

## 40. Unified Architecture (Phase 12)

**Added: 2025-12-04** | **Result: CODE COMPLETE**

Phase 12 implements CSV import enhancements for credit card statements.

### Credit Card Statement Detection
- [ ] Headers analyzed for credit card indicators (card number, limit, etc.)
- [ ] Transaction patterns analyzed (purchases vs payments)
- [ ] Detection confidence calculated and displayed
- [ ] Filename checked for issuer hints

### Auto-Detection UI
- [ ] Detection banner shows source type (Credit Card / Bank)
- [ ] Confidence percentage displayed
- [ ] Detected issuer name shown (if detected)
- [ ] Source Type selector allows override (Auto, Bank, Credit Card)

### Card Issuer Templates
- [ ] Template dropdown shows 8 issuers (Chase, Amex, etc.)
- [ ] Selecting template auto-applies column mappings
- [ ] Template date format applied
- [ ] Template amount convention applied
- [ ] Generic Credit Card template available

### Transaction Type Detection
- [ ] Payment transactions detected (payment, thank you, autopay)
- [ ] Refund transactions detected (refund, return, credit)
- [ ] Interest charges detected (interest charge, finance charge)
- [ ] Fee transactions detected (annual fee, late fee)
- [ ] Cash advances detected (cash advance, ATM)
- [ ] Balance transfers detected (balance transfer, BT)
- [ ] Rewards detected (reward, cashback, statement credit)
- [ ] Default to purchase for unmatched transactions
- [ ] Transaction type badges displayed in preview

### Statement Info Extraction
- [ ] Statement balance extracted from header rows
- [ ] Due date extracted from header rows
- [ ] Minimum payment extracted from header rows
- [ ] Credit limit extracted from header rows
- [ ] Statement info card displayed in preview

### Transfer Duplicate Prevention
- [ ] Existing transfers checked for matching amounts
- [ ] Date proximity considered (±3 days)
- [ ] Opposite transaction types matched
- [ ] Transfer keywords boost confidence
- [ ] High-confidence matches flagged for review
- [ ] Transfer match banner in preview summary
- [ ] Transfer match confidence on individual rows

### Column Mapping Updates
- [ ] New fields: cc_transaction_type, reference_number
- [ ] New fields: statement_balance, statement_date, statement_due_date
- [ ] New fields: minimum_payment, credit_limit, available_credit
- [ ] Fields organized by group (Required, Amount, Optional, Credit Card, Statement Info)

### Database Schema
- [ ] import_templates: source_type, issuer, amount_sign_convention columns
- [ ] import_templates: transaction_type_patterns, statement_info_config columns
- [ ] import_history: source_type, statement_info columns
- [ ] import_staging: cc_transaction_type, potential_transfer_id, transfer_match_confidence columns
- [ ] Migration 0068 applied successfully
- [ ] All new indexes created

### API Updates
- [ ] POST /api/csv-import accepts sourceType, issuer, amountSignConvention
- [ ] Response includes sourceType, detectedIssuer, statementInfo
- [ ] Response includes transferMatches count
- [ ] Staging records include ccTransactionType, potentialTransferId
- [ ] Credit card processing applied when sourceType=credit_card

---

## 41. Unified Architecture (Phase 13)

**Tested: 2025-12-08** | **Result: PARTIALLY VERIFIED**

Phase 13 implements dashboard widget updates to use the unified debt architecture.

### Debt-Free Countdown Widget
- [x] Uses unified debt sources (credit accounts + debt bills) - Shows credit card debt
- [x] Credit accounts with type=credit or line_of_credit included - Test Chase Sapphire credit card included
- [ ] Debt bills with isDebt=true included - NOT TESTED (no debt bills in test data)
- [x] Only debts with balance > 0 counted - Confirmed $2,500 remaining
- [ ] Only debts with includeInPayoffStrategy=true in payoff calculation - NOT VERIFIED
- [ ] Focus debt shows source indicator (account vs bill) - NOT VISIBLE on dashboard widget
- [ ] Strategy settings read from householdSettings table - NOT VERIFIED
- [ ] Response includes source breakdown (creditAccounts, debtBills counts) - NOT VERIFIED
- [ ] Debt-free celebration shows when no unified debts exist - NOT TESTABLE

### Credit Utilization Widget
- [x] Uses accounts table instead of debts table - Confirmed via API response
- [x] Includes credit type accounts (credit cards) - "1 card tracked"
- [ ] Includes line_of_credit type accounts - NOT TESTED (no LOC accounts)
- [x] Only active accounts included - Confirmed
- [x] Only accounts with creditLimit > 0 included - Confirmed ($10,000 limit)
- [x] Uses Math.abs(currentBalance) for balance - 25.0% = $2,500 / $10,000
- [x] Response includes accountId alongside debtId - API includes linkedAccount.id
- [x] Response includes accountType field - API includes linkedAccount.type
- [x] Summary includes creditCardCount and lineOfCreditCount - "1 card tracked"
- [x] Utilization calculations match previous behavior - 25.0% correct

### Next Payment Due Widget
- [x] Shows next 5 upcoming bill payments - Shows 3 bills (Dec, Jan, Feb)
- [ ] Overdue bills highlighted with red indicator - NOT TESTED (no overdue bills)
- [ ] Overdue bills sorted first (oldest first) - NOT TESTED
- [x] Pending bills sorted by due date (soonest first) - Dec 14, Jan 14, Feb 14
- [x] Credit card payment bills show credit card icon - Icon visible on items
- [x] Credit card payment bills show linked account name - API includes linkedAccount.name
- [ ] Autopay-enabled bills show lightning bolt icon - NOT TESTED (no autopay)
- [x] Days until due label shows correctly - "Due in 7 days", "Due in 38 days", "Due in 69 days"
- [ ] Overdue label shows correctly - NOT TESTED
- [ ] Summary shows overdue count and total - NOT TESTED
- [!] Summary shows next 7 days count and total - **BUG**: Shows "0 bills" but bill is due in 7 days (Dec 14)
- [ ] "View all bills" link appears when more bills exist - NOT VISIBLE
- [ ] Empty state shows "All caught up!" message - NOT APPLICABLE
- [x] Clicking row navigates to bills page - Links to /dashboard/bills

### Dashboard Layout
- [x] Bills section uses responsive grid layout - Observed
- [x] EnhancedBillsWidget takes 2/3 width on large screens - Appears correct
- [x] NextPaymentDueWidget takes 1/3 width on large screens - Appears correct
- [ ] Widgets stack vertically on mobile - NOT TESTED

### API Endpoints
- [x] GET /api/debts/countdown returns unified debt data - Via dashboard widget
- [x] GET /api/debts/credit-utilization uses accounts table - Via dashboard widget
- [x] GET /api/bills/next-due returns upcoming bill instances - Verified with curl
- [x] All endpoints filter by household correctly - Requires x-household-id header
- [x] All endpoints require authentication - TEST_MODE bypass working

---

## 42. Unified Architecture (Phase 14)

**Tested: 2025-12-08** | **Result: UI VERIFIED**

Phase 14 implements balance history tracking, utilization trends, and interest paid reporting.

### Daily Balance Snapshot Cron Job
- [ ] POST /api/cron/balance-snapshots creates snapshots for all credit accounts - NOT TESTED
- [ ] Cron secret validation works in production mode - NOT TESTED
- [ ] Only active credit accounts included (type=credit or line_of_credit) - NOT TESTED
- [ ] Duplicate snapshots prevented (same account + same date) - NOT TESTED
- [ ] Snapshot includes balance, creditLimit, availableCredit, utilizationPercent - NOT TESTED
- [ ] GET endpoint returns preview of accounts needing snapshots - NOT TESTED
- [ ] Response includes stats (total, created, skipped) - NOT TESTED

### Accounts Page Charts
- [ ] "Show Trends" button visible only when credit accounts exist - NOT TESTED on Accounts page
- [ ] Button toggles chart visibility - NOT TESTED
- [x] Utilization Trends chart displays correctly - VERIFIED in Debts page Trends section with Y-axis 0-100%
- [x] Balance History chart displays correctly - VERIFIED with account legend and dollar amounts
- [x] Time range selectors work (30/60/90 days) - Buttons visible: 30 Days, 60 Days, 90 Days
- [ ] Charts refresh when data changes - NOT TESTED

### Interest Paid Report
- [ ] GET /api/accounts/interest-paid returns interest data - NOT TESTED
- [ ] Interest detected by description patterns (INTEREST CHARGE, FINANCE CHARGE, etc.) - NOT TESTED
- [ ] Interest detected by category (isInterestCategory=true) - NOT TESTED
- [ ] Summary includes totalInterestPaid, ytdInterestPaid, averageMonthly - NOT TESTED
- [ ] Monthly breakdown shows per-account amounts - NOT TESTED
- [ ] Account breakdown shows totals with APR - NOT TESTED
- [ ] Transaction list includes all interest payments - NOT TESTED

### Interest Paid Chart (on Debts page)
- [x] Chart displays in expandable Trends section - VERIFIED: "Utilization & Balance Trends" expands to show charts
- [ ] Summary stats show total, YTD, and average monthly - NOT VISIBLE (shows positive empty state)
- [x] Time range selector works (6 months, 1 year, 2 years) - Buttons visible: 6 Months, 1 Year, 2 Years
- [ ] Monthly view shows stacked bars by account - NOT TESTABLE (no interest data)
- [ ] By Account view shows horizontal bars - NOT TESTABLE
- [ ] Account breakdown table shows details with APR - NOT TESTABLE
- [x] Empty state shows positive message - VERIFIED: "No interest charges found. This is a good thing!"

### Database
- [ ] accountBalanceHistory table being populated by cron
- [ ] Snapshots have correct date format (YYYY-MM-DD)
- [ ] All indexes working for efficient queries

---

## 43. Unified Architecture (Phase 15)

**Added: 2025-12-04** | **Result: CODE COMPLETE**

Phase 15 simplifies the category system from 6 types to 3 types (income, expense, savings).

### Category Type Migration
- [ ] Existing categories with variable_expense type migrated to expense
- [ ] Existing categories with monthly_bill type migrated to expense
- [ ] Existing categories with non_monthly_bill type migrated to expense
- [ ] Existing categories with debt type migrated to expense
- [ ] Income and savings categories unchanged

### Category Form
- [ ] Type dropdown shows only 3 options: Income, Expense, Savings
- [ ] New categories default to "Expense" type
- [ ] Due date field removed (bills module handles due dates)
- [ ] Form saves correctly with new types

### Categories Page
- [ ] Filter buttons show 3 types plus "All"
- [ ] Filter correctly shows categories by type
- [ ] Category cards display correct type labels

### Budget Manager
- [ ] Grouped categories show Income, Expenses, Savings sections
- [ ] Variable bills and fixed bills sections merged into Expenses
- [ ] Budget totals calculate correctly

### Transaction Category Selector
- [ ] Expense transactions show expense categories
- [ ] Income transactions show income categories
- [ ] New categories created with correct type

### API Endpoints
- [ ] GET /api/categories returns simplified types
- [ ] POST /api/categories accepts new type values
- [ ] GET /api/budgets/overview uses simplified grouping
- [ ] GET /api/budgets/allocation-summary uses simplified structure

---

## 44. Unified Architecture (Phase 16)

**Tested: 2025-12-08** | **Result: PARTIALLY VERIFIED**

Phase 16 adds recurring income tracking using the bills system, allowing users to track expected income (salary, rent, dividends, etc.) and get alerts when expected income is late.

### Bill Form - Income Bills
- [x] Bill Type selector appears at top of form (Income vs Expense) - Two radio-style buttons with icons
- [ ] Selecting Income hides debt configuration section - NOT TESTED
- [ ] Selecting Income hides credit card linking section - NOT TESTED
- [ ] Income-specific classification options shown (Salary, Rental, Investment, etc.) - NOT TESTED
- [ ] Labels update for income context ("Expected Date" vs "Due Date") - NOT TESTED
- [ ] Info box shows income-specific description - NOT TESTED
- [ ] Save buttons show income-specific text ("Save Income", "Update Income") - NOT TESTED

### Bills API Validation
- [ ] POST /api/bills rejects isDebt=true for income bills - NOT TESTED
- [ ] POST /api/bills rejects linkedAccountId for income bills - NOT TESTED
- [ ] POST /api/bills rejects chargedToAccountId for income bills - NOT TESTED
- [ ] PUT /api/bills/[id] validates income bill restrictions - NOT TESTED

### Bills Page Display
- [x] Filter tabs visible: All, Expenses, Income - All (1), Expenses (1), Income (0)
- [x] Clicking Income filter shows only income bills - Shows empty state when no income bills
- [x] Income statistics cards appear when Income filter selected - Labels change to income-specific
- [ ] Income bills show green income icon and styling - NO INCOME BILLS TO VERIFY
- [x] Income bills show "Expected" instead of "Due" - Stats show "Expected (30 days)"
- [x] Income bills show "Received" instead of "Paid" - Stats show "Received this month"
- [x] Income bills show "Late" instead of "Overdue" - Stats show "Late Income"
- [x] Income amounts show with + prefix - "+$0.00 total" shown

### Income Late Notifications
- [ ] Cron endpoint POST /api/cron/income-alerts runs successfully - NOT TESTED
- [ ] Late income notifications created for overdue income bills - NOT TESTED
- [ ] Upcoming income reminders created for expected income - NOT TESTED
- [ ] Notification type 'income_late' used correctly - NOT TESTED

### Calendar Integration
- [x] Calendar day modal shows "Bills & Income" header - Confirmed in Phase 9 testing
- [ ] Income bills appear on calendar with distinct styling - NO INCOME BILLS
- [ ] Income bills show income icon (ArrowDownCircle) - NO INCOME BILLS
- [ ] Income status shows "expected", "received", "late" - NO INCOME BILLS
- [ ] Income amounts shown in green with + prefix - NO INCOME BILLS

### Budget Overview
- [ ] GET /api/budgets/overview includes recurringIncomeExpected - NOT TESTED
- [ ] Response includes recurringIncomeReceived - NOT TESTED
- [ ] Response includes recurringIncomePending - NOT TESTED
- [ ] Response includes recurringIncomeLate - NOT TESTED
- [ ] Response includes recurringIncomeSourceCount - NOT TESTED

### Notification Preferences
- [ ] Income Late Alerts section visible in Settings > Notifications - NOT TESTED
- [ ] Enable/disable toggle for late income alerts works - NOT TESTED
- [ ] Channel selector shows push/email options - NOT TESTED
- [ ] Preferences save correctly to database - NOT TESTED

---

## 45. Unified Architecture (Phase 17)

**Tested: 2025-12-08** | **Result: UI VERIFIED**

Phase 17 adds budget rollover functionality, allowing unused budget to carry forward to the next month.

### Rollover Settings per Category
- [x] Expense categories show rollover toggle in Rollover Summary - Shows "Interest Fees" and "Bank Fees" with "Enable rollover" buttons
- [x] Toggle on/off updates category rolloverEnabled field - Clicking "Enable rollover" changes header from "0 categories" to "1 categories", button changes to "Disable rollover"
- [x] Rollover limit input appears when rollover enabled - Spinbutton with Save/Cancel appears when clicking gear icon
- [ ] Limit saves correctly (or null for unlimited) - NOT TESTED (cancelled without saving)
- [ ] Reset button clears rollover balance to 0 - NOT TESTED (no reset button visible in current UI)
- [ ] Reset records entry in rollover history - NOT TESTED

### Rollover Display in Budget UI
- [ ] Categories with rollover show badge (refresh icon) - NOT TESTED (no categories with active budgets)
- [ ] Badge color: green for positive, red for negative, gray for zero - NOT TESTED
- [ ] Effective budget shows base + rollover amount - NOT TESTED
- [ ] Breakdown text shows "base + rollover" when applicable - NOT TESTED
- [ ] Negative rollover shows deficit message - NOT TESTED

### Rollover Summary Component
- [x] Collapsible section appears on Budgets page - "Budget Rollover" button/section visible at bottom
- [x] Header shows total rollover balance and category count - Shows "0 categories with $0.00 total"
- [x] Expanded view lists all expense categories - Shows Interest Fees and Bank Fees when expanded
- [x] Each category shows rollover toggle and current balance - "Enable rollover" button and "Budget: $0.00" shown
- [x] Settings button opens limit editor - Gear icon opens inline editor with spinbutton
- [x] Info banner explains rollover feature - Shows "Rollover allows unused budget from one month to carry forward to the next."

### Budget Overview API
- [ ] GET /api/budgets/overview includes rolloverEnabled per category
- [ ] Response includes rolloverBalance per category
- [ ] Response includes rolloverLimit per category
- [ ] Response includes effectiveBudget (base + rollover)
- [ ] Remaining calculation uses effective budget when rollover enabled
- [ ] Status determination uses effective budget

### Rollover Management APIs
- [ ] GET /api/budgets/rollover returns summary with all categories
- [ ] GET /api/categories/[id]/rollover returns category settings and history
- [ ] PUT /api/categories/[id]/rollover updates rollover settings
- [ ] DELETE /api/categories/[id]/rollover resets balance to 0

### Monthly Rollover Cron Job
- [ ] GET /api/cron/budget-rollover processes all households
- [ ] POST /api/cron/budget-rollover allows manual trigger
- [ ] Rollover calculates: unused budget = monthlyBudget - actualSpent
- [ ] Positive unused adds to rollover balance
- [ ] Negative unused (overspent) respects allowNegativeRollover setting
- [ ] Rollover limit caps the balance if set
- [ ] History entry created for each calculation

### Household Settings
- [ ] allowNegativeRollover setting stored in household_settings
- [ ] Setting displayed in Rollover Summary info banner
- [ ] When disabled, overspending doesn't reduce next month's budget
- [ ] When enabled, overspending creates negative rollover balance

---

## 46. Unified Architecture (Phase 18)

**Added: 2025-12-04** | **Result: CODE COMPLETE**

Phase 18 adds savings-goals integration with the transaction system, allowing users to link transfers to savings goals, track contributions, view savings rate analytics, and see contribution history.

### Goal Selector Component
- [ ] Goal selector appears when creating transfer to savings account
- [ ] Dropdown shows all active savings goals sorted by account link
- [ ] Goals linked to the destination account appear first with label
- [ ] Each goal shows progress bar and percentage
- [ ] Single goal selection works correctly
- [ ] Multi-select (split) mode toggle works
- [ ] Split mode allows adding multiple goals
- [ ] Split amounts can be edited per goal
- [ ] "Split Equally" button distributes amount evenly
- [ ] Total allocated shows and highlights match/mismatch

### Transaction Form Integration
- [ ] Goal selector shows for transfer type transactions
- [ ] Goal selector shows when destination account is selected
- [ ] Selected goal(s) included in transaction submission
- [ ] Form resets goal selection after successful save
- [ ] Form resets goal selection on "Save & Add Another"

### Auto-Detection for Savings Transfers
- [ ] Detection banner shows when transferring to savings account
- [ ] Single linked goal auto-selected with "high" confidence message
- [ ] Multiple linked goals show "medium" confidence message
- [ ] Savings account without linked goals shows "low" confidence message
- [ ] Non-savings accounts show no detection message
- [ ] Auto-detection API endpoint works correctly

### Transaction Display with Goal Badges
- [ ] Goal badge appears on transactions linked to savings goals
- [ ] Badge shows goal name and uses goal color
- [ ] Badge appears in transactions list page
- [ ] Badge appears in recent transactions widget
- [ ] "Savings Contributions Only" filter works in advanced search
- [ ] Filter correctly shows only transactions with savingsGoalId

### Savings Rate Tracking
- [ ] GET /api/reports/savings-rate returns monthly/quarterly/yearly data
- [ ] API calculates savings rate as (savings/income) percentage
- [ ] Summary includes average rate, total saved, trend indicator
- [ ] Savings rate chart displays data correctly
- [ ] Reference line at target rate (20%) shown
- [ ] Savings rate widget shows current month rate
- [ ] Widget shows 3-month average and trend icon

### Contribution History
- [ ] GET /api/savings-goals/[id]/contributions returns contribution list
- [ ] Contributions include transaction details (description, date, account)
- [ ] Pagination works correctly (limit, offset, hasMore)
- [ ] Running total calculated correctly
- [ ] Contributions list component displays timeline view
- [ ] "Load More" button works for pagination
- [ ] View History button in goal tracker opens contributions list

### Enhanced Savings Goals Widget
- [ ] Widget shows recent contribution for each goal
- [ ] Quick-contribute button opens dialog
- [ ] Preset amounts ($25, $50, $100, $200) work
- [ ] Custom amount entry works
- [ ] Contribution success updates goal progress
- [ ] Savings rate mini-indicator displays
- [ ] Trend icon shows up/down/stable

### Transaction API Updates
- [ ] POST /api/transactions accepts savingsGoalId
- [ ] POST /api/transactions accepts goalContributions array
- [ ] savingsGoalId saved to transaction record
- [ ] Single goal contribution updates goal currentAmount
- [ ] Split contributions update multiple goals
- [ ] Milestone notifications created when thresholds crossed
- [ ] Goal progress update is non-blocking (errors logged, not thrown)
- [ ] GET /api/transactions includes savingsGoalName and savingsGoalColor

### Savings Goal Contributions Table
- [ ] savings_goal_contributions table created
- [ ] Proper indexes created for transaction, goal, and user/household

### Contribution Handler Library
- [ ] handleGoalContribution updates goal currentAmount
- [ ] handleGoalContribution creates contribution record
- [ ] handleGoalContribution checks milestones (25%, 50%, 75%, 100%)
- [ ] handleGoalContribution creates milestone notifications
- [ ] handleMultipleContributions processes array of contributions
- [ ] revertGoalContribution reduces goal amount
- [ ] revertAllContributions handles transaction deletion
- [ ] getGoalContributions returns contribution history
- [ ] getTotalContributions calculates sum

---

## 47. Unified Architecture (Phase 19)

**Tested: 2025-12-08** | **Result: VERIFIED**

Bill Classification & Subscription Management

### Auto-Suggestion Logic
- [x] Typing "Netflix" suggests "Subscription" classification - WORKING: "Suggested: Subscription (Streaming)" banner appeared
- [ ] Typing "Electric" suggests "Utility" classification - NOT TESTED
- [ ] Typing "Rent" suggests "Housing" classification - NOT TESTED
- [ ] Typing "Geico" suggests "Insurance" classification - NOT TESTED
- [ ] Typing "Student Loan" suggests "Loan Payment" classification - NOT TESTED
- [ ] Typing "Gym" or "Costco" suggests "Membership" classification - NOT TESTED
- [ ] Typing "Lawn Service" suggests "Service" classification - NOT TESTED
- [x] Suggestion appears after characters typed (Netflix test confirmed)
- [ ] Suggestion shows confidence-based styling - NOT VERIFIED
- [x] Subcategory shown when detected (e.g., "streaming") - "(Streaming)" shown for Netflix

### Suggestion UI in Bill Form
- [x] Suggestion banner appears below bill name field
- [x] Banner shows classification name with icon (shown as "Suggested: **Subscription** (Streaming)")
- [x] "Apply" button sets the classification (confirmed - dropdown changed to "Subscription")
- [ ] "X" (dismiss) button hides suggestion
- [ ] Suggestion not shown when editing existing bills
- [ ] Suggestion not shown after manually selecting classification
- [ ] Toast notification confirms classification applied

### Classification Filter Bar (Bills Page)
- [x] Filter bar appears below bill type filter
- [x] All 8 classification buttons visible (All, Subscriptions, Utilities, Housing, Insurance, Loans, Memberships, Services, Other)
- [x] Each button shows icon, label, and count badge
- [x] "All" filter shows total bill count
- [ ] Active filter has colored background matching classification - NOT TESTED
- [ ] Clicking filter updates bill lists - NOT TESTED
- [ ] Type filter (All/Expenses/Income) and classification filter work together - NOT TESTED
- [ ] Counts update when bills are added/removed - NOT TESTED

### Classification Badges on Bills
- [ ] Classification badge appears on bill items (not "other")
- [ ] Badge uses appropriate classification color
- [ ] Badge appears in pending bills list
- [ ] Badge appears in paid bills list
- [ ] Badge appears in overdue bills list

### Bills by Classification Widget (Dashboard)
- [ ] Widget appears in sidebar on dashboard
- [ ] Pie/donut chart shows monthly spend by classification
- [ ] Category list shows up to 5 classifications
- [ ] Each category shows icon, label, count, monthly total, percentage
- [ ] Upcoming bills count shown for each classification
- [ ] Footer shows 30-day upcoming totals
- [ ] Click-through navigation works to filtered bills page
- [ ] Empty state shown when no active bills
- [ ] Loading skeleton displays while fetching

### Classification Summary API
- [ ] GET /api/bills/classification-summary returns summary data
- [ ] Response includes all non-empty classifications
- [ ] Monthly amounts correctly normalized from different frequencies
- [ ] Weekly bills multiplied by ~4.33
- [ ] Quarterly bills divided by 3
- [ ] Annual bills divided by 12
- [ ] One-time bills not included in monthly totals
- [ ] Upcoming counts reflect next 30 days
- [ ] Totals calculated correctly
- [ ] Results sorted by monthly total descending
