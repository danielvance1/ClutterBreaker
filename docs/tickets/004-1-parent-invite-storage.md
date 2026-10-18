# Ticket 004-1: Parent invite storage (migration, repo, tests)

**Written to be done by hand.** Expected time: 30 to 45 minutes. Claude Code will review it instead of writing it. This is the first half of ticket 004. Part 004-2 adds the endpoints.

## Goal

Add the database table and the database functions for parent invites, with tests. No HTTP routes yet. After this ticket, the code can create an invite and atomically "claim" it exactly once, and nothing else uses it.

## Context

- A parent can only join an existing family through an invite that is tied to one email address, can be used once, and expires. See design doc sections 6 (Accounts and sessions) and 7 (`parent_invites`).
- The invite token itself (a random string) is created in 004-2. This ticket only stores its SHA-256 hash, the same way sessions do. The repo functions receive `tokenHash` and never see the raw token.
- Copy the patterns you already reviewed in ticket 003: the `sessions` migration, `src/repos/sessions.ts`, and its test file.

## In scope

1. Create branch `ticket/004-1-invite-storage` from `main`.

2. **Migration** `npm run db:new create_parent_invites`, with a working `down` (drop the table).

   `parent_invites`
   - `id` integer, generated always as identity, primary key
   - `family_id` integer, not null, references `families(id)` on delete cascade
   - `invited_by` integer, not null, references `users(id)` on delete cascade
   - `email` text, not null (stored lower-cased)
   - `token_hash` text, not null, unique
   - `created_at` timestamptz, not null, default `now()`
   - `expires_at` timestamptz, not null
   - `used_at` timestamptz, nullable (null means not used yet)
   - Index on `family_id` and an index on `invited_by` (foreign keys need their own indexes)

3. **Repo** `src/repos/parentInvites.ts`, same pattern as before (`db` first argument, explicit columns, parameterized SQL, camelCase results):

   - `createInvite(db, { familyId, invitedBy, email, tokenHash, expiresAt })` returns `{ id, familyId, email, expiresAt }`. The email is lower-cased by the SQL (`lower($n)`). It never returns `tokenHash`.
   - `claimInvite(db, { tokenHash, email })` returns `{ familyId, email } | null`. It must be **one single UPDATE statement** that sets `used_at = now()` where all of these are true: the `token_hash` matches, `lower(email)` matches the given email, `used_at IS NULL`, and `expires_at > now()`. It uses `RETURNING family_id, email`. If no row matches, it returns `null`. It must not do a SELECT first and then an UPDATE, because two requests at the same moment could both pass the SELECT. One UPDATE means only one of them can win.

4. **Tests** in a new file under `tests/repos/`. In each test, create a family and a parent with the existing repos, then:
   - `createInvite` returns the invite, lower-cases the email, and the result has no `tokenHash` property.
   - `claimInvite` with the right hash and email returns `{ familyId, email }`.
   - Claiming the same invite a second time returns `null`.
   - Claiming with a different email returns `null`, and the invite can still be claimed afterward with the right email.
   - The email match ignores letter case.
   - An expired invite (create it with an `expiresAt` in the past) returns `null`.
   - An unknown hash returns `null`.
   - Creating two invites with the same `tokenHash` rejects.
   - Deleting the family deletes its invites.

## Out of scope

- Any route, middleware, or change to `src/app.ts`
- Generating tokens, building links, or sending email (004-2)
- Joining a family or creating a user from an invite (004-2)
- Login throttling (004-2)
- Cleanup of old invites
- Any new dependency
- Any change to `CLAUDE.md` or the README

## Acceptance criteria

- [ ] `npm run db:up`, `npm run db:down`, and `npm run db:up` again all work on the dev database
- [ ] `claimInvite` is a single SQL statement, parameterized, with no `SELECT *`
- [ ] No function in the file returns the token hash
- [ ] Every test in the list above exists and passes
- [ ] `npm run typecheck` and `npm test` pass
- [ ] No files were changed other than the migration, the new repo file, and the new test file

## How to verify

```bash
git checkout ticket/004-1-invite-storage
npm run db:up
npm run db:down
npm run db:up
npm run typecheck
npm test
docker compose exec db psql -U app -d appdb -c '\d parent_invites'
```

## Review focus

Read in this order:
1. The migration: columns, the unique constraint on `token_hash`, and the two foreign-key indexes.
2. `claimInvite`: one statement, all four conditions in the `WHERE`, `RETURNING` the right columns, and the `null` result when nothing matches.
3. The tests: the second-claim, wrong-email, and expired cases, since those protect the security rules.