# Repository Guidelines

## Project Structure & Module Organization
Next.js 16 app router code lives in `app/`, shared UI in `components/`, and domain logic in `lib/`. State stores sit in `contexts/` and `hooks/`, while Drizzle schemas stay in `drizzle/`. `proxy.ts` guards routes with Better Auth helpers in `auth.ts`. Assets belong in `public/`, and tests mirror runtime folders inside `__tests__/api|components|integration|lib|utils`. Enforce household isolation via `lib/api/household-auth.ts` or `useHouseholdFetch`.

## Build, Test, and Development Commands
Use pnpm:
```
pnpm dev                 # Next + Serwist
pnpm build && pnpm start # Prod build/serve
pnpm lint                # ESLint (TS)
pnpm test                # Vitest
pnpm test:watch | test:coverage
pnpm db:init             # Seed SQLite
pnpm db:studio           # Drizzle Studio
pnpm drizzle-kit push    # Schema sync
```

## Coding Style & Naming Conventions
Use 2-space indentation, PascalCase components/layouts, kebab-case server utilities, `@/` imports, and hook names starting with `use`; run `npx prettier --write .` before each PR. Money logic always uses `decimal.js`. Stick to semantic Tailwind tokens (`bg-background`, `text-[var(--color-income)]`, etc.) and compose repeats with `cn`.

## Database & API Practices
The schema lives in `lib/db/schema.ts` and syncs via `pnpm drizzle-kit push`. Household ID filters are mandatory—reuse `useHouseholdFetch` or `lib/api/household-auth.ts`. Use `lib/utils/enhanced-fetch.ts` for retries, timeouts, and deduping. API responses stay `{ data, total, limit, offset }` or `{ error }`, and every route must confirm the Better Auth session plus ownership.

## Testing Guidelines
Vitest + Testing Library run in jsdom via `test-setup.ts`. Specs live under `__tests__/**` and follow the `*.test.ts(x)` or `*.spec.ts(x)` pattern. Global thresholds are 80% lines/functions (75% branches); critical modules in `lib/transactions`, `lib/rules`, `lib/tax`, and autopay utilities must hit the 95–100% caps inside `vitest.config.ts`. Run `pnpm test:coverage` before touching money movement, sync, or rule-matching flows.

## Commit & Pull Request Guidelines
Commits follow Conventional prefixes (`fix:`, `chore:`, `feat:`) with imperative summaries such as `fix: Correct budget template endpoint path`. PRs need a concise description, screenshots for UI, linked issue IDs, schema or seeding notes (`drizzle/`, `scripts/init-db.js`), and proof that `pnpm lint && pnpm test` passed. Note coverage changes on files with enforced thresholds.

## Security & Configuration Tips
Secrets stay in `.env.local`; never commit live credentials or regenerated `sqlite.db`. `proxy.ts` should only enforce auth, track activity, and honor test mode, so remove unused routes that could leak headers. When changing Better Auth or Serwist behavior, update both `auth.ts` and `next.config.ts`. Back up SQLite before schema pushes and document cron or autopay tweaks in `docs/`.
