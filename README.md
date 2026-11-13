# [APP_NAME]

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)

Campus pickup food that is ready before your next class — HKBU hackathon entry.

> **Demo data.** Outlet names and hours are from HKBU's public pages. Menus, prices and wait times are simulated. Not affiliated with HKBU Estates Office or its caterers.

## Status

This repo is at **milestone M0** — scaffold only. Features land across M1–M16 (see `PLAN.md`).

## Run it

Prereqs: Docker. That's it.

```
docker compose up
```

Then open http://localhost:3000.

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
