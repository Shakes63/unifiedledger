# Bills V2 Rewrite (Big-Bang)

## Scope
This document defines the full Bills rewrite plan with a hard cutover strategy.

- No backward compatibility layer.
- No dual-write period.
- No feature flags.
- Old Bills API/UI/service code is removed at cutover.

## Product Outcomes
1. One canonical bill model for templates, occurrences, allocations, and payments.
2. One atomic payment pipeline for manual pay, autopay, and matching-assisted pay.
3. One consistent API contract for all bill screens.
4. Cents-only money math in persistence and services.

## Domain Model
### Core Entities
1. `bill_templates`: recurring bill definition.
2. `bill_occurrences`: generated payable bill units.
3. `bill_occurrence_allocations`: split budget-period allocations per occurrence.
4. `bill_payment_events`: immutable payment events applied to an occurrence.
5. `autopay_rules`: autopay behavior for template.
6. `autopay_runs`: autopay execution audit and idempotency.
7. `bill_match_events`: matching decisions and confidence trail.

## Exact Table Schema
All amounts are integer cents. All timestamps are ISO strings (`text`) for cross-db consistency with current schema style.

### `bill_templates`
- `id text primary key`
- `household_id text not null`
- `created_by_user_id text not null`
- `name text not null`
- `description text`
- `is_active integer not null default 1`
- `bill_type text not null check (bill_type in ('expense','income','savings_transfer'))`
- `classification text not null check (classification in ('subscription','utility','housing','insurance','loan_payment','membership','service','other'))`
- `classification_subcategory text`
- `recurrence_type text not null check (recurrence_type in ('one_time','weekly','biweekly','monthly','quarterly','semi_annual','annual'))`
- `recurrence_due_day integer` (1-31 for month-based)
- `recurrence_due_weekday integer` (0-6 for week-based)
- `recurrence_specific_due_date text` (for one-time)
- `recurrence_start_month integer` (0-11 for periodic)
- `default_amount_cents integer not null default 0`
- `is_variable_amount integer not null default 0`
- `amount_tolerance_bps integer not null default 500` (5.00% = 500)
- `category_id text`
- `merchant_id text`
- `payment_account_id text`
- `linked_liability_account_id text`
- `charged_to_account_id text`
- `auto_mark_paid integer not null default 1`
- `notes text`
- `debt_enabled integer not null default 0`
- `debt_original_balance_cents integer`
- `debt_remaining_balance_cents integer`
- `debt_interest_apr_bps integer`
- `debt_interest_type text check (debt_interest_type in ('fixed','variable','none'))`
- `debt_start_date text`
- `debt_color text`
- `include_in_payoff_strategy integer not null default 1`
- `interest_tax_deductible integer not null default 0`
- `interest_tax_deduction_type text check (interest_tax_deduction_type in ('none','mortgage','student_loan','business','heloc_home')) default 'none'`
- `interest_tax_deduction_limit_cents integer`
- `budget_period_assignment integer`
- `split_across_periods integer not null default 0`
- `created_at text not null`
- `updated_at text not null`

Indexes and constraints:
- `index bill_templates_household_active_idx (household_id, is_active)`
- `index bill_templates_household_type_idx (household_id, bill_type)`
- `index bill_templates_household_class_idx (household_id, classification)`
- `index bill_templates_linked_liability_idx (household_id, linked_liability_account_id)`

### `bill_occurrences`
- `id text primary key`
- `template_id text not null`
- `household_id text not null`
- `due_date text not null`
- `status text not null check (status in ('unpaid','partial','paid','overpaid','overdue','skipped'))`
- `amount_due_cents integer not null`
- `amount_paid_cents integer not null default 0`
- `amount_remaining_cents integer not null`
- `actual_amount_cents integer`
- `paid_date text`
- `last_transaction_id text`
- `days_late integer not null default 0`
- `late_fee_cents integer not null default 0`
- `is_manual_override integer not null default 0`
- `budget_period_override integer`
- `notes text`
- `created_at text not null`
- `updated_at text not null`

Indexes and constraints:
- `unique(template_id, due_date)`
- `index bill_occurrences_household_due_idx (household_id, due_date)`
- `index bill_occurrences_household_status_due_idx (household_id, status, due_date)`
- `index bill_occurrences_template_idx (template_id)`

### `bill_occurrence_allocations`
- `id text primary key`
- `occurrence_id text not null`
- `template_id text not null`
- `household_id text not null`
- `period_number integer not null`
- `allocated_amount_cents integer not null`
- `paid_amount_cents integer not null default 0`
- `is_paid integer not null default 0`
- `payment_event_id text`
- `created_at text not null`
- `updated_at text not null`

Indexes and constraints:
- `unique(occurrence_id, period_number)`
- `index allocations_household_occurrence_idx (household_id, occurrence_id)`

### `bill_payment_events`
- `id text primary key`
- `household_id text not null`
- `template_id text not null`
- `occurrence_id text not null`
- `transaction_id text not null`
- `amount_cents integer not null`
- `principal_cents integer`
- `interest_cents integer`
- `balance_before_cents integer`
- `balance_after_cents integer`
- `payment_date text not null`
- `payment_method text not null check (payment_method in ('manual','transfer','autopay','match'))`
- `source_account_id text`
- `idempotency_key text`
- `notes text`
- `created_at text not null`

Indexes and constraints:
- `unique(idempotency_key)` where not null
- `index payment_events_household_date_idx (household_id, payment_date)`
- `index payment_events_occurrence_idx (occurrence_id)`

### `autopay_rules`
- `id text primary key`
- `template_id text not null unique`
- `household_id text not null`
- `is_enabled integer not null default 0`
- `pay_from_account_id text not null`
- `amount_type text not null check (amount_type in ('fixed','minimum_payment','statement_balance','full_balance'))`
- `fixed_amount_cents integer`
- `days_before_due integer not null default 0`
- `created_at text not null`
- `updated_at text not null`

Indexes:
- `index autopay_rules_household_enabled_idx (household_id, is_enabled)`

### `autopay_runs`
- `id text primary key`
- `household_id text not null`
- `run_date text not null`
- `run_type text not null check (run_type in ('scheduled','manual','dry_run'))`
- `status text not null check (status in ('started','completed','failed'))`
- `processed_count integer not null default 0`
- `success_count integer not null default 0`
- `failed_count integer not null default 0`
- `skipped_count integer not null default 0`
- `total_amount_cents integer not null default 0`
- `error_summary text`
- `started_at text not null`
- `completed_at text`

Indexes:
- `index autopay_runs_household_date_idx (household_id, run_date)`

### `bill_match_events`
- `id text primary key`
- `household_id text not null`
- `transaction_id text not null`
- `template_id text`
- `occurrence_id text`
- `confidence_bps integer not null`
- `decision text not null check (decision in ('suggested','accepted','rejected','auto_linked','no_match'))`
- `reasons_json text`
- `created_at text not null`

Indexes:
- `index bill_match_events_household_tx_idx (household_id, transaction_id)`
- `index bill_match_events_household_created_idx (household_id, created_at)`

## State Machine
### Occurrence Status
1. `unpaid`
2. `partial`
3. `paid`
4. `overpaid`
5. `overdue`
6. `skipped`

Transitions:
- `unpaid -> partial|paid|overpaid|overdue|skipped`
- `partial -> paid|overpaid|overdue|skipped`
- `overdue -> partial|paid|overpaid|skipped`
- `paid|overpaid|skipped -> unpaid` only through explicit reset action.

## API Contract (V2)
Base error payload:
```json
{ "error": "string", "code": "string", "details": {} }
```

### Templates
- `GET /api/bills-v2/templates`
  - Query: `isActive`, `billType`, `classification`, `limit`, `offset`
  - Response: `{ data: BillTemplateDto[], total, limit, offset }`
- `POST /api/bills-v2/templates`
  - Body: `CreateBillTemplateRequest`
  - Response: `{ data: BillTemplateDto }`
- `PUT /api/bills-v2/templates/:id`
  - Body: `UpdateBillTemplateRequest`
  - Response: `{ data: BillTemplateDto }`
- `DELETE /api/bills-v2/templates/:id`
  - Response: `{ success: true }`

### Occurrences
- `GET /api/bills-v2/occurrences`
  - Query: `status`, `from`, `to`, `periodOffset`, `billType`, `limit`, `offset`
  - Response: `{ data: BillOccurrenceWithTemplateDto[], summary, total, limit, offset }`
- `POST /api/bills-v2/occurrences/:id/pay`
  - Body: `PayOccurrenceRequest`
  - Response: `{ data: PayOccurrenceResponse }`
- `POST /api/bills-v2/occurrences/:id/skip`
  - Body: `{ notes?: string }`
  - Response: `{ data: BillOccurrenceDto }`
- `POST /api/bills-v2/occurrences/:id/reset`
  - Response: `{ data: BillOccurrenceDto }`
- `PUT /api/bills-v2/occurrences/:id/allocations`
  - Body: `UpdateOccurrenceAllocationsRequest`
  - Response: `{ data: BillOccurrenceAllocationDto[] }`

### Automation and Dashboard
- `POST /api/bills-v2/autopay/run`
  - Body: `{ runType: 'scheduled' | 'manual' | 'dry_run' }`
  - Response: `{ data: AutopayRunResultDto }`
- `GET /api/bills-v2/dashboard-summary`
  - Query: `windowDays` (default `30`)
  - Response: `{ data: BillsDashboardSummaryDto }`

## Service Layer
- `OccurrenceEngine`
- `PaymentEngine`
- `AllocationEngine`
- `AutopayEngine`
- `MatchEngine`

All engines are invoked through service orchestrators and only orchestrators touch route handlers.

## File Structure (Target)
- `lib/bills-v2/contracts.ts`
- `lib/bills-v2/domain/*`
- `lib/bills-v2/services/*`
- `app/api/bills-v2/*`
- `components/bills-v2/*`
- `app/dashboard/bills-v2/*`

## Big-Bang Cutover Checklist
1. Build and wire v2 DB schema.
2. Build all v2 routes and v2 UI.
3. Replace all bill callers to v2 routes.
4. Delete old bill routes/services/components.
5. Run lint/test/build and fix breakages.
