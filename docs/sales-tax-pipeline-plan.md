# Sales Tax Pipeline – Implementation Plan

## Goal
Finish the remaining “Sales Tax Pipeline” backlog items by adding **targeted automated coverage** for:
- exemption behavior (taxable vs exempt transactions)
- multi-jurisdiction rate calculations
- quarterly aggregation outputs

## Current State
- Sales tax reports read from `transactions.isSalesTaxable` (true/false), and calculate totals per quarter.
- Multi-level rate breakdown exists via `calculateTaxBreakdown()` in `lib/sales-tax/sales-tax-utils.ts`.
- Quarterly endpoint composes per-quarter + overall breakdown in `app/api/sales-tax/quarterly/route.ts`.

## Plan

### 1) Add unit tests for core calculation utilities (first task)
- `lib/sales-tax/sales-tax-utils.ts`
  - `calculateTaxAmount()` (percent inputs)
  - `calculateTaxBreakdown()` (state/county/city/special + total)
  - `getQuarterDates()` (date ranges + due dates)
- `getQuarterlyReport()` aggregation behavior:
  - filters to `type='income'` and `isSalesTaxable=true`
  - sums amounts using `Decimal`
  - applies configured rate and returns taxRate as decimal

### 2) Add API contract tests for quarterly endpoint
- `GET /api/sales-tax/quarterly`:
  - validates year/quarter params
  - returns overall + per-quarter breakdown when settings exist

### 3) Verify exemption rules are exercised
- Unit tests ensure that `isSalesTaxable=false` is excluded.
- (Optional follow-up) If merchant-level exemption auto-flips `isSalesTaxable`, add a focused unit test around that helper once located.

## Test Plan
- `pnpm test __tests__/lib/sales-tax/sales-tax-utils.test.ts`
- `pnpm test __tests__/api/sales-tax-quarterly.test.ts`
