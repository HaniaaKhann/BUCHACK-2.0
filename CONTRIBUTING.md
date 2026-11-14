# Contributing

Short, current repo rules.

## Overview

ReadyBy is a campus pickup-food web app for HKBU. It has student timetable-aware ranking, a vendor order board and a hybrid wait-time engine that learns from in-app outcomes. It is a pnpm monorepo.

```
apps/
  web/        Next.js (App Router): student, vendor, admin, API, SSE
  worker/     Node TS: engine jobs, shared clock, demo load generator
packages/
  core/       pure engine, ranking, fit, leave-at, slots (fully unit tested)
  db/         Prisma schema, migrations, seed, seed-data
  integrations/  PaymentProvider + PlatformAdapter interfaces
  simulator/  optional Kaggle importer, history generator, backtest
docker/
  setup/      one-off migrate + seed container
docs/         ARCHITECTURE, WAIT_TIME_ENGINE, PRIVACY, DATA, API, AUTH, VENDOR_ONBOARDING
```

## Scope

Current priority is a judge-ready submission. Features beyond it are listed under Roadmap in the README and are not built.

## Coding rules

- TypeScript strict. No `any`. Small pure functions. Clear names.
- No code comments. Explanations go in `docs/`.
- Do not add features, refactors or abstractions beyond what the task requires.
- Validate at system boundaries only. Trust internal and framework guarantees.
- `packages/core` is pure functions only. The database and jobs call it.

## Security rules

- Server-side role checks on every route.
- `zod` on every input.
- Parameterised queries through Prisma.
- httpOnly session cookies. Passwords are hashed with scrypt by Better Auth.
- In-memory token-bucket rate limiter per user, noted in the docs.

## Secrets

- No secrets in code or commits. `.env` is gitignored. `.env.example` lists keys with placeholder values only.
- The chatbot is rules only: no external service, no API key and no network call.

## Testing and local development

```
pnpm install
pnpm --filter @app/db prisma:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
docker compose up
```

- Unit and integration tests: Vitest. End-to-end: Playwright in `tests/e2e`.
- CI runs install, format check, lint, typecheck, test, the worker database tests and build against a Postgres service.

## Commits

- Many small Conventional Commits, one per logical group.
- No secrets, `.env` files or raw data files in commits.

## Architecture decisions

- Shared clock: one `system_clock` row (mode, current time, speed) read by web and worker. Demo mode drives engine jobs on clock ticks.
- Realtime: Postgres `LISTEN`/`NOTIFY` fan-out over SSE. No Redis.
- Engine snapshots: one row per vendor per 15 clock-minutes, `payload JSONB`. A live estimate is the latest snapshot plus the live queue.
- `model_version`, `predicted_point`, `predicted_low` and `predicted_high` are stored on every order for honest evaluation.
- Payments: a mock wallet behind the `PaymentProvider` interface. Movements are stored in `wallet_ledger`, with no balance column.
- Platform integration: the `PlatformAdapter` interface is declared. There is no implementation.

## Demo data rules

- Outlet names, campus, building, floor, opening hours and official dietary options come from HKBU's public pages (see `docs/DATA.md`), with `source_url` and `retrieved_at` on every outlet.
- Walk times are estimates unless measured with a stopwatch. The UI shows "est." on estimates.
- Menus, prices, orders, ticket counts and wait times are simulated. A banner on every screen says so.
- The shipped menus are hand-written in `packages/db/seed-data/menus_generic.json`. They are enough for the full demo.
- The Kaggle importer in `packages/simulator/src/kaggle/` is optional. Its output is never committed, and the raw Kaggle files in `data/raw/` are never committed. The dataset is used only to build menus, never to train or test the wait-time engine.
- Imported restaurant names are stripped from every item, and imported diet and allergen tags stay "Unverified" until a vendor owner verifies them.
- Caterer brand names, logos and photos from HKBU pages are never reused.
