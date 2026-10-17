# Ticket 002: Database foundation (migrations, test database, first tables)

## Goal

Add the database layer once, so every later ticket is just SQL plus logic. This ticket adds a migration tool, an isolated test database, the first two tables, and the pattern for writing database code (repos) with tests. It is the last infrastructure ticket. After it, a typical feature ticket is one migration, one repo file, some routes, and tests.

## Context

After ticket 001 the project has Express, `pg` (`src/db.ts` exports the pool), Vitest, and a Postgres 16 container in `docker-compose.yml`. Read `CLAUDE.md` first. The data model is in `docs/design.md` section 7, but this ticket only creates `families` and `users`. Other tables come with the tickets that need them.

## In scope

1. Create branch `ticket/002-database-foundation` from `main`.

2. **Migrations with dbmate.**
   - Install `dbmate` as a dev dependency. Migrations live in `db/migrations/`.
   - Add npm scripts: `db:new` (create a migration file), `db:up`, `db:down` (roll back the latest migration only), `db:status`.
   - The scripts read `DATABASE_URL`. Check dbmate's documented flags and env loading instead of guessing. If dbmate's schema dump fails because `pg_dump` isn't installed locally, turn the dump off in the scripts.
   - Update `.env.example` so `DATABASE_URL` ends with `?sslmode=disable` (needed for local Postgres without SSL). Do not read or edit `.env`. Say in the PR that I need to make the same change in my local `.env`.

3. **First migration**, created with `npm run db:new create_families_and_users`. It must have working `up` and `down` sections (down drops in reverse order).

   `families`
   - `id` integer, generated always as identity, primary key
   - `name` text, not null
   - `join_code` text, not null, unique
   - `created_at` timestamptz, not null, default `now()`

   `users`
   - `id` integer, generated always as identity, primary key
   - `family_id` integer, not null, references `families(id)` on delete cascade
   - `role` text, not null, must be `'parent'` or `'kid'`
   - `display_name` text, not null
   - `email` text, `password_hash` text, `pin_hash` text (all nullable columns)
   - `created_at` timestamptz, not null, default `now()`
   - A CHECK constraint so a parent row has `email` and `password_hash` and no `pin_hash`, and a kid row has `pin_hash` and neither `email` nor `password_hash`
   - Unique index on `lower(email)`
   - Unique index on `(family_id, lower(display_name))`, so names are unique within a family
   - Index on `family_id`

4. **Isolated test database.**
   - Tests run against a separate database `appdb_test` on the same Postgres container, never against `appdb`.
   - The test URL comes from `TEST_DATABASE_URL`, defaulting to `postgres://app:devpassword@localhost:5432/appdb_test?sslmode=disable` when unset.
   - Before the tests run, the test database is created if missing and migrated to the latest version, automatically (a Vitest global setup is the natural place). `npm test` must work with only `docker compose up -d` done beforehand.
   - Safety guard: if the test URL's database name doesn't end in `_test`, throw a clear error before anything runs.
   - Tests must make `src/db.ts` connect to the test URL (set `DATABASE_URL` in the test environment before the pool is created).
   - Test files run one at a time (not in parallel), since they share one database.
   - The pool is closed when the tests finish so Vitest exits cleanly.
   - Add `tests/helpers/db.ts` exporting `resetDb()`. It truncates every table in the `public` schema except dbmate's `schema_migrations` and restarts identity counters. Tests call it in `beforeEach`.

5. **Repo pattern.** Create `src/repos/families.ts` and `src/repos/users.ts` as plain async functions. The first parameter of every function is `db`, which is anything with a `query` method (a pool or a transaction client), so later tickets can run these inside transactions. SQL is hand-written, parameterized, lists columns explicitly (no `SELECT *`), and is mapped to camelCase TypeScript objects inside the repo.

   Types
   - `Family`: `id`, `name`, `joinCode`, `createdAt`
   - `User`: `id`, `familyId`, `role`, `displayName`, `email` (string or null), `createdAt`. A `User` never contains a hash.

   Functions
   - `createFamily(db, { name, joinCode })` returns `Family`
   - `findFamilyByJoinCode(db, joinCode)` returns `Family | null`
   - `createParent(db, { familyId, displayName, email, passwordHash })` returns `User`
   - `createKid(db, { familyId, displayName, pinHash })` returns `User`
   - `findUserById(db, id)` returns `User | null`
   - `findParentWithHashByEmail(db, email)` returns `(User & { passwordHash: string }) | null`. Email matching is case-insensitive. This is the only function allowed to return a hash.

   Hash values are just strings passed in. Hashing itself is not part of this ticket.

6. **Tests** (`tests/repos/families.test.ts`, `tests/repos/users.test.ts`, plus one for `resetDb`). Each behavior below gets a test:
   - Creating a family returns it with an id and a createdAt; `findFamilyByJoinCode` finds it; an unknown code returns null.
   - Two families with the same join code: the second insert rejects.
   - `createParent` returns a user with role `parent` and no hash fields; `createKid` returns role `kid`.
   - `findUserById` returns the user, and null for an id that doesn't exist.
   - `findParentWithHashByEmail` matches regardless of letter case, returns the hash, and returns null for an unknown email.
   - A second parent with the same email in a different letter case rejects.
   - Two users in the same family with the same display name (different letter case) rejects; the same display name in two different families is allowed.
   - A raw SQL insert of a parent with a `pin_hash` is rejected by the CHECK constraint, and so is a kid with an email.
   - Deleting a family deletes its users.
   - `resetDb()` empties the tables, and ids start from 1 again afterward.
   - A test that sets `TEST_DATABASE_URL` to a database name without the `_test` suffix and confirms the guard throws.

7. **Update `CLAUDE.md`** by adding exactly this, and leaving everything else in the file alone.

   In "Layout", add:
   - `db/migrations/` : dbmate migrations
   - `src/repos/` : all SQL, one file per feature area
   - `src/routes/` : HTTP handlers (added as features arrive)
   - `src/lib/` : other helpers

   In "Commands", add:
   - `npm run db:up` : apply pending migrations to the dev database
   - `npm run db:down` : roll back the latest migration
   - `npm run db:new <name>` : create a migration file
   - `npm run db:status` : show applied and pending migrations
   - `npm test` runs against the separate `appdb_test` database and creates and migrates it automatically.

   In "Hard rules", add:
   - Never edit a migration that has been merged to `main`; add a new one. Every migration has working `up` and `down` sections, and a ticket that changes the schema adds its own migration.
   - Tests use the real test database. Do not mock the database. Call `resetDb()` in `beforeEach`. Tests must never connect to the dev database.
   - Never return password or PIN hashes from a function unless its name contains `WithHash`. Never put hashes in API responses or logs.

   New section, "Code style":
   - Write for a reader who knows TypeScript and SQL but didn't write this code. Prefer plain functions and plain objects over classes and clever abstractions.
   - `src/routes/` handles HTTP only: validate input, check permissions, call repos, shape the response. `src/repos/` holds all SQL as plain async functions that take `db` as the first argument. `src/lib/` holds other helpers.
   - Keep each SQL statement readable: one statement per function where possible, columns listed explicitly, a short comment when the reason isn't obvious.
   - Repo functions return camelCase objects; mapping from snake_case columns happens inside the repo.
   - Keep functions short. Comment why, not what.

8. **Update `README.md`** with the db scripts, how the test database works, and the `?sslmode=disable` note for `.env`.

## Out of scope

- Any table other than `families` and `users`
- HTTP routes, authentication, password or PIN hashing, tokens
- Generating join codes (callers pass one in)
- Seed data
- Dockerfile, CI, deployment
- Any dependency other than `dbmate`

## Acceptance criteria

- [ ] After dropping the test database, `npm test` recreates it, migrates it, and passes (see commands below)
- [ ] `npm run typecheck` passes
- [ ] `npm run db:up` on the dev database creates both tables, `npm run db:down` removes them, and `npm run db:up` works again afterward
- [ ] Running `npm test` never creates or modifies anything in the dev database `appdb`
- [ ] No repo function other than `findParentWithHashByEmail` can return a hash
- [ ] All SQL is parameterized, with no `SELECT *`
- [ ] `CLAUDE.md` contains the additions above and nothing else changed in it
- [ ] The PR description follows the format in `CLAUDE.md` and tells me to update my local `.env`

## How to verify

```bash
git checkout ticket/002-database-foundation
# edit your local .env so DATABASE_URL ends with ?sslmode=disable
docker compose up -d
npm install
npm run db:up
npm run db:status
npm run db:down
npm run db:up
docker compose exec db psql -U app -d postgres -c 'DROP DATABASE IF EXISTS appdb_test'
npm run typecheck
npm test
docker compose exec db psql -U app -d appdb -c '\dt'
```

The last command should list only `families`, `users`, and `schema_migrations` (from `db:up`), with no rows in the first two.

## Review focus

Read in this order:
1. The migration SQL. Check the CHECK constraint and the unique indexes match the list above.
2. The test database guard and `resetDb()`. A bug here could wipe the dev database.
3. The repo functions. Every query parameterized, no `SELECT *`, no hash leaking out of anything except `findParentWithHashByEmail`.
4. The tests. Each behavior in the list should have one, and they should read like a spec.
