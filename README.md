# ClutterBreaker

A chores app that plays like a game. Parents post chores as "quests" with coin rewards. Kids mark them done, and parents approve or reject. Approval pays coins, breaks the quest card in half, and drops a chest with a random bonus. Kids spend coins in a parent-defined reward shop.

This repo currently holds the backend (Node, TypeScript, Express, PostgreSQL). The frontend comes later.

## Prerequisites

- Node 22
- Docker (for the dev database)

## First-time setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:up
```

`DATABASE_URL` in `.env` must end with `?sslmode=disable` (see `.env.example`). dbmate requires SSL unless you turn it off, and the local Postgres container has none. If you created `.env` before this was added, edit it to match.

## Running

```bash
npm run dev                   # API with auto-reload on http://localhost:3000
curl localhost:3000/health    # {"status":"ok"}
```

## npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the API with auto-reload (reads `.env`) |
| `npm start` | Start the API once (reads `.env`) |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm test` | Run the Vitest suite once (against `appdb_test`, see below) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run db:new <name>` | Create a migration file in `db/migrations/` |
| `npm run db:up` | Apply pending migrations to the dev database |
| `npm run db:down` | Roll back the latest migration only |
| `npm run db:status` | Show applied and pending migrations |

## Database and migrations

Migrations are plain SQL files in `db/migrations/`, run by [dbmate](https://github.com/amacneil/dbmate). Each file has a `-- migrate:up` and a `-- migrate:down` section. The db scripts read `DATABASE_URL` from `.env` and skip the schema dump, because `pg_dump` isn't installed locally.

## Test database

Tests run against a separate database, `appdb_test`, on the same Postgres container. They never touch `appdb`.

- Before the tests start, a Vitest global setup creates `appdb_test` if it is missing and migrates it to the latest version. Only `docker compose up -d` is needed first.
- The URL comes from `TEST_DATABASE_URL`, defaulting to `postgres://app:devpassword@localhost:5432/appdb_test?sslmode=disable`. If its database name doesn't end in `_test`, the tests refuse to run.
- Test files run one at a time because they share one database. Call `resetDb()` (from `tests/helpers/db.ts`) in `beforeEach` to empty the tables.

## Auth

Parents sign up (which creates their family), log in, and stay logged in with an httpOnly `session` cookie (30 days). Errors are JSON: `{ "error": "message" }`.

- `POST /auth/signup` creates a family and its first parent, and returns 201 `{ user, family }`.

  ```bash
  curl -i -c jar.txt -X POST localhost:3000/auth/signup \
    -H 'Content-Type: application/json' \
    -d '{"email":"mom@example.com","password":"correct-horse-battery","displayName":"Mom","familyName":"Vance"}'
  ```

- `POST /auth/login` logs a parent in and returns 200 `{ user }`.

  ```bash
  curl -i -c jar.txt -X POST localhost:3000/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"mom@example.com","password":"correct-horse-battery"}'
  ```

- `POST /auth/logout` ends the session and returns 204.

  ```bash
  curl -i -b jar.txt -X POST localhost:3000/auth/logout
  ```

- `GET /auth/me` returns 200 `{ user }` for a valid session, 401 otherwise.

  ```bash
  curl -i -b jar.txt localhost:3000/auth/me
  ```

## More

The full design (data model, rules, API sketch, screens, chest odds) is in [`docs/design.md`](docs/design.md). Tickets are in `docs/tickets/`.
