import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db.js';
import { createFamily } from '../../src/repos/families.js';
import {
  createSession,
  deleteSession,
  findUserByActiveSession,
} from '../../src/repos/sessions.js';
import { createParent } from '../../src/repos/users.js';
import { resetDb } from '../helpers/db.js';

let userId: number;
const future = () => new Date(Date.now() + 60_000);

beforeEach(async () => {
  await resetDb();
  const family = await createFamily(pool, { name: 'Smiths', joinCode: 'ABCDEFGH' });
  userId = (
    await createParent(pool, {
      familyId: family.id,
      displayName: 'Mom',
      email: 'mom@example.com',
      passwordHash: 'pw-hash',
    })
  ).id;
});

describe('sessions repo', () => {
  it('finds the user for an active session, with no hash fields', async () => {
    await createSession(pool, { userId, tokenHash: 'h1', expiresAt: future() });
    const user = await findUserByActiveSession(pool, 'h1');
    expect(user).toMatchObject({ id: userId, role: 'parent' });
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('ignores expired sessions and unknown hashes', async () => {
    await createSession(pool, { userId, tokenHash: 'old', expiresAt: new Date(Date.now() - 1000) });
    expect(await findUserByActiveSession(pool, 'old')).toBeNull();
    expect(await findUserByActiveSession(pool, 'nope')).toBeNull();
  });

  it('deleteSession removes the row', async () => {
    await createSession(pool, { userId, tokenHash: 'h1', expiresAt: future() });
    await deleteSession(pool, 'h1');
    expect(await findUserByActiveSession(pool, 'h1')).toBeNull();
  });
});
