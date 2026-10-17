# Ticket 001: Project scaffold and test foundation

## Goal

Create the backend project from scratch so it runs, type-checks, and tests itself. Every later ticket depends on being able to run `npm run typecheck` and `npm test`, so this ticket builds that foundation and nothing else.

## Context

The repo currently contains only a `README.md`. There is no code yet. Read `CLAUDE.md` first, and skim `docs/design.md` section 3 (tech stack) for background. The target layout is in `CLAUDE.md`.

## In scope

1. Create branch `ticket/001-project-scaffold` from `main`.
2. Initialize the Node project: `package.json` named `clutterbreaker`, `"private": true`, `"type": "module"`.
3. Install runtime dependencies: `express`, `pg`.
4. Install dev dependencies: `typescript`, `tsx`, `vitest`, `supertest`, `@types/node`, `@types/express`, `@types/pg`, `@types/supertest`.
5. Create `tsconfig.json` with: target `ES2022`, module and moduleResolution `NodeNext`, `strict` true, `esModuleInterop` true, `skipLibCheck` true, and `include` covering `src` and `tests`.
6. Create the server code:
   - `src/db.ts`: exports a `pg` Pool built from `process.env.DATABASE_URL`.
   - `src/app.ts`: builds and exports the Express app with `express.json()` and `GET /health`, which returns `{ "status": "ok" }` with HTTP 200. `/health` must not touch the database.
   - `src/server.ts`: imports the app and listens on `process.env.PORT` or 3000, logging the URL.
7. Add a test, `tests/health.test.ts`, using supertest against the exported app: `GET /health` returns 200 and `{ status: "ok" }`.
8. Add these npm scripts:
   - `dev`: `tsx watch --env-file=.env src/server.ts`
   - `start`: `tsx --env-file=.env src/server.ts`
   - `typecheck`: `tsc --noEmit`
   - `test`: `vitest run`
   - `test:watch`: `vitest`
9. Create `docker-compose.yml` with one service, `db`: image `postgres:16`, `POSTGRES_USER=app`, `POSTGRES_PASSWORD=devpassword`, `POSTGRES_DB=appdb`, port `5432:5432`, and a named volume `pgdata` for data. No schema or init scripts yet.
10. Create `.env.example` containing `DATABASE_URL=postgres://app:devpassword@localhost:5432/appdb`.
11. Create `.gitignore` with: `node_modules`, `dist`, `.env`, `client/node_modules`, `client/dist`.
12. Update the existing `README.md`: keep what is already there and add a short project description, prerequisites (Node 22, Docker), first-time setup commands (including `cp .env.example .env`), the npm scripts, and a pointer to `docs/design.md`.

Do not create, read, or edit `.env`. The human creates it from `.env.example`.

## Out of scope

- Database schema, migrations, or any tables
- Authentication or any endpoint besides `/health`
- A test database
- The `client/` frontend
- A Dockerfile, build step, CI, or deployment
- Any dependency not listed above

## Acceptance criteria

- [ ] `npm run typecheck` passes with no errors
- [ ] `npm test` passes and runs the health test
- [ ] `docker compose up -d` starts the database
- [ ] With a local `.env` copied from `.env.example`, `npm run dev` starts the API and `curl localhost:3000/health` returns `{"status":"ok"}`
- [ ] `.env` is ignored by git and `.env.example` exists
- [ ] `README.md` setup instructions match what was actually done
- [ ] The PR description follows the format in `CLAUDE.md`

## How to verify

```bash
git checkout ticket/001-project-scaffold
cp .env.example .env
docker compose up -d
npm install
npm run typecheck
npm test
npm run dev                   # in one terminal
curl localhost:3000/health    # in another
```

## Review focus

Low risk. Confirm `package.json` contains only the dependencies listed above, that no secrets were added, and that `docker-compose.yml` and `.gitignore` match the scope.
