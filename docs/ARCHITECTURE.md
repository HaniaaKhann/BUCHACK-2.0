# Architecture

## Stack (pinned at M0, 2026-11-13)

| Layer           | Package                 | Version           |
| --------------- | ----------------------- | ----------------- |
| Runtime         | Node                    | 22 LTS            |
| Package manager | pnpm                    | 9.15.0            |
| Language        | TypeScript              | 5.7.2             |
| Web app         | next                    | 15.1.3            |
| UI              | react / react-dom       | 19.0.0            |
| Styling         | tailwindcss             | 3.4.17            |
| Validation      | zod                     | 3.24.1            |
| Database        | PostgreSQL              | 17 (Alpine image) |
| ORM             | prisma / @prisma/client | 6.1.0             |
| Lint            | eslint                  | 9.17.0            |
| Lint (TS)       | typescript-eslint       | 8.19.0            |
| Format          | prettier                | 3.4.2             |
| Unit tests      | vitest                  | 2.1.8             |
| E2E             | @playwright/test        | installed in M14  |
| Worker bundler  | tsx                     | 4.19.2            |

Exact pins live in each `package.json`. Update only with a note here.

## Services (Docker)

```
db       postgres:17-alpine
setup    one-shot: prisma migrate deploy + prisma db seed (lands in M1)
web      next.js standalone build
worker   node TS worker: shared clock + engine jobs (lands in M4-M6)
```

`docker compose up` brings up `db`, waits for it to be healthy, runs `setup` to completion, then starts `web` and `worker` in parallel.

## Workspace layout

```
apps/web         Next.js app (student / vendor / admin / API / SSE)
apps/worker      Background worker (clock ticks, snapshots, slot fire, demo load)
packages/core    Pure engine + ranking + fit + leave-at + slots. No I/O.
packages/db      Prisma schema, migrations, seed, seed data
packages/integrations  PaymentProvider (mock wallet) + PlatformAdapter interface
packages/simulator     Kaggle importer + history generator + backtest
```

Every package pins its deps exactly. Cross-package imports use workspace protocol (`workspace:*`).

## Shared clock

A single-row `system_clock` table holds mode (`real` | `demo`), current time and speed. Both `web` and `worker` read it on every tick/request. In demo mode, the admin UI (M11) controls time; the worker converts real elapsed time to simulated clock time and fires engine jobs on clock-minute boundaries.

## Realtime

Postgres `LISTEN` / `NOTIFY` fans out order and snapshot changes. `apps/web` opens a long-running listener and pushes Server-Sent Events to subscribed clients. No Redis.

## Engine snapshots

The worker writes one `engine_snapshots` row per vendor every 15 clock-minutes (`model_version`, `computed_at`, `payload JSONB`). Live per-request estimates combine the latest snapshot with the live queue.

## Security

- Server-side RBAC on every route and action.
- `zod` on every request body, query, and tool call.
- Prisma parameterises every query.
- Session cookies: httpOnly, SameSite=Lax. Passwords hashed by Better Auth.
- `.env` is gitignored. `.env.example` has placeholder values only.
- In-memory token-bucket rate limiter per user. Adequate for one instance; documented limit.

## Build

- `apps/web` uses Next.js `output: 'standalone'` for a minimal Docker image.
- `apps/worker` compiles with `tsc` to `dist/` and runs under plain Node.
- `packages/*` export source TypeScript directly (via `"exports"` map) so Next can `transpilePackages` them.

## CI

GitHub Actions `ci.yml`: install → format check → lint → typecheck → test → build. A Postgres 17 service container is attached for integration tests (M14).
