# Repository Guidelines
This project has no users yet. We are trying to get it into a state where we are ready to ship. Do not hesitate to refactor and rewrite in ways that affect old data or old systems. It is ok to break things to make them better.

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
