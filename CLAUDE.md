# ClutterBreaker

Chores app that plays like a game. Parents post chores as "quests" with coin rewards. Kids mark them done, parents approve or reject. Approval pays coins, breaks the quest card in half, and drops a chest with a random bonus. Kids spend coins in a parent-defined reward shop. Target kids: ages 8-12.

Full design (data model, rules, API sketch, screens, chest odds): `docs/design.md`. Read it when a ticket touches the data model, game rules, API, or screens. Do not duplicate it here.

## Stack

- Node 22, TypeScript (strict, ESM, NodeNext), Express, `pg` with hand-written SQL
- PostgreSQL 16 in Docker (`docker-compose.yml`); migrations live in `db/migrations/` (added in a later ticket)
- Frontend (later): React + TypeScript + Tailwind via Vite in `client/`, delivered as a mobile-first PWA

## Layout

- `src/` : server code (`app.ts` builds the Express app, `server.ts` starts it, `db.ts` holds the pg pool)
- `tests/` : Vitest tests
- `docs/design.md` : design doc
- `docs/tickets/` : one markdown file per ticket

## Commands

- `docker compose up -d` : start the dev database
- `npm run dev` : API with auto-reload on http://localhost:3000 (needs a local `.env`, which the human creates)
- `npm run typecheck` : `tsc --noEmit`
- `npm test` : Vitest
- Both `typecheck` and `test` must pass before you say a ticket is done.

## Hard rules

- SQL is hand-written and always parameterized (`$1, $2`). No ORM, no query builder, no string-built SQL.
- Because of NodeNext, relative imports in TypeScript use the `.js` extension (`import { app } from './app.js'`).
- Coins only move through rows in the `ledger` table, inside a database transaction. Balance is `SUM(ledger.amount)`; never store a balance column.
- Chest odds are rolled on the server only, with the odds kept in one config file.
- Every endpoint checks the caller's role and family. Never trust a family or user id from the request body.
- Never commit secrets. Do not read, print, or edit `.env`. `.env.example` holds placeholders only.
- Never add a dependency without saying why in the PR description.

## Workflow

- One ticket per session. Tickets live in `docs/tickets/`. Do only what the ticket's scope says.
- Start from an up-to-date `main` and create a branch named `ticket/NNN-short-name`.
- Never commit to `main`, never force push, never merge a PR. The human reviews and merges.
- Make small commits with clear messages.
- If you notice something outside the ticket's scope, do not fix it. Put it under "Noticed but not done" in the PR description.
- If a requirement is ambiguous and involves auth, PINs, or coins, stop and ask instead of guessing.
- Finish by pushing the branch and opening a PR with `gh pr create`. The PR description must have: what changed, how to verify it (exact commands), risks, and "Noticed but not done".
