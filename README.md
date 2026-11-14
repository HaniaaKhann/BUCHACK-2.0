# ReadyBy

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)

Campus pickup food that is ready before your next class — HKBU hackathon entry.

> **Demo data.** Outlet names and hours are from HKBU's public pages. Menus, prices and wait times are simulated, and wallet money is demo money. Not affiliated with HKBU Estates Office or its caterers.

## Status

This repo is at **milestone M0** — scaffold only. Features land across M1–M16 (see `PLAN.md`).

## Run it

Prereqs: Docker. That's it.

```
docker compose up
```

Then open http://localhost:3000.

The database is not published on the host, so it never clashes with a local Postgres. To reach it from the host, pick a free port: `DB_HOST_PORT=55432 docker compose -f docker-compose.yml -f docker-compose.db-port.yml up`.

`docker compose up` runs everything with `DEMO_MODE=true` (set for the setup, web and worker services in `docker-compose.yml`). Demo mode seeds the demo accounts and the simulated history, and it is the only mode where the admin can change the clock.

Demo admin login: `admin@demo.example` with password `demo-password-1`. After signing in you land on `/admin`, which has the demo clock (speed, jump forward, set a time) and the accuracy page. Other demo accounts are listed in `docs/AUTH.md`. These are demo logins only, with no real credentials.

The student dashboard has a chat assistant in English, Traditional Chinese and Simplified Chinese. It is rules only: it matches the question in the browser, reads the student's own data from the existing endpoints, and answers from that data. There is no external service, no API key, no chat route, and nothing is stored or sent; the history lives in the page and disappears on reload. It cannot filter by spice and it never calls a dish halal unless the vendor owner confirmed it.

To return a running demo to its starting state (fixed clock, no orders, seeded stock and tags), run `pnpm demo:reset` with `DEMO_MODE=true` and `DATABASE_URL` set.

## Local development

Prereqs: Node 22+, pnpm 9+, Docker (for Postgres).

```
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Repo layout

See `docs/ARCHITECTURE.md` for the stack and pinned versions.

## Theme

Placeholder: [THEME]. (One honest sentence linking the product to the hackathon theme goes here.)

## Team

[TEAM_SIZE_AND_SKILLS]

## License

TBD.
