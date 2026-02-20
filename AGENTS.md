# Repository Guidelines

## Project Structure & Module Organization
Next.js 16 App Router code lives in `app/`, shared UI in `components/`, and domain logic in `lib/`. State and hooks are split across `contexts/`, `context/`, `hooks/`, and `lib/hooks/` (for shared domain hooks like `useHouseholdFetch`). Drizzle schema definitions live in `lib/db/schema.ts` with dialect-specific files in `lib/db/schema.sqlite.ts` and `lib/db/schema.pg.ts`; generated migrations live in `drizzle/sqlite` and `drizzle/postgres`. Route/session protection lives in `proxy.ts` with helpers in `lib/session-utils.ts`, `lib/auth-helpers.ts`, and `lib/better-auth.ts` (`auth.ts` is a root re-export for CLI compatibility). Assets belong in `public/`, and tests live in `__tests__/api|app|components|hooks|integration|lib|utils`. Enforce household isolation via `lib/api/household-auth.ts` (API) or `lib/hooks/use-household-fetch.ts` (client).

## Build, Test, and Development Commands
Use pnpm:
```
pnpm dev                 # Next.js dev server (Serwist disabled in dev)
pnpm build && pnpm start # Prod build/serve
pnpm lint                # ESLint (TS)
pnpm test                # Vitest
pnpm test:watch | pnpm test:coverage
pnpm test:ui             # Vitest UI
pnpm db:init             # Seed SQLite
pnpm db:studio           # Drizzle Studio
pnpm db:generate:sqlite  # Generate SQLite migrations
pnpm db:migrate:sqlite:safe # Bootstrap + migrate SQLite
pnpm db:generate:pg      # Generate Postgres migrations
pnpm db:migrate:pg       # Apply Postgres migrations
pnpm db:verify:money     # Validate money integrity constraints
```

## Coding Style & Naming Conventions
Use 2-space indentation, PascalCase components/layouts, kebab-case server utilities, `@/` imports, and hook names starting with `use`; run `npx prettier --write .` before each PR. Store money values as integer cents for persistence and use `decimal.js` for precision-safe conversions/calculations at boundaries. Stick to semantic Tailwind tokens (`bg-background`, `text-[var(--color-income)]`, etc.) and compose repeats with `cn`.

## Database & API Practices
Schema exports are centralized in `lib/db/schema.ts`, with dialect-specific definitions in `lib/db/schema.sqlite.ts` and `lib/db/schema.pg.ts`; generate/migrate with the matching pnpm DB scripts. Household ID filters are mandatory: use `lib/api/household-auth.ts` in API routes and `lib/hooks/use-household-fetch.ts` in client code. Prefer `requireAuth` from `lib/auth-helpers.ts` for session checks before ownership checks. Use `lib/utils/enhanced-fetch.ts` for retries, timeouts, deduping, and offline queueing when resilient fetch behavior is needed. Prefer consistent API envelopes (`{ data, total, limit, offset }` for list endpoints, `{ error }` for failures) with appropriate HTTP status codes.

## Testing Guidelines
Vitest + Testing Library run in jsdom via `test-setup.ts`. Specs live under `__tests__/**` and follow the `*.test.ts(x)` or `*.spec.ts(x)` pattern. Global thresholds are 80% lines/functions/statements and 75% branches. Enforced high-priority thresholds in `vitest.config.ts` currently include: 100% for `lib/transactions/split-calculator.ts`, `lib/tax/*.ts`, `lib/sales-tax/*.ts`; 95% for rule/bill matching and duplicate detection; 90% for `lib/csv-import.ts`, `lib/notifications/*.ts`, and `lib/offline/*.ts`. Run `pnpm test:coverage` before touching money movement, sync, matching, tax, or notification flows.

## Commit & Pull Request Guidelines
Commits follow Conventional prefixes (`fix:`, `chore:`, `feat:`) with imperative summaries such as `fix: Correct budget template endpoint path`. PRs need a concise description, screenshots for UI, linked issue IDs, schema or seeding notes (`drizzle/`, `scripts/init-db.js`), and proof that `pnpm lint && pnpm test` passed. Note coverage changes on files with enforced thresholds.

## Security & Configuration Tips
Secrets stay in `.env.local`; never commit live credentials or generated database files (`sqlite.db`, `local.db`, `unifiedledger.db`). `proxy.ts` should only enforce auth/session behavior, activity tracking, and test mode handling; keep matcher scope intentional. When changing Better Auth behavior, update `lib/better-auth.ts` and keep `auth.ts` re-export compatibility intact. When changing Serwist behavior, update both `next.config.ts` and `app/sw.ts`. Back up SQLite before migrations/schema changes and document cron/autopay/background-task tweaks in `docs/`.
