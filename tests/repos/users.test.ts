import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db.js';
import { createFamily } from '../../src/repos/families.js';
import {
  createKid,
  createParent,
  findParentWithHashByEmail,
  findUserById,
} from '../../src/repos/users.js';
import { resetDb } from '../helpers/db.js';

let familyId: number;

beforeEach(async () => {
  await resetDb();
  familyId = (await createFamily(pool, { name: 'The Smiths', joinCode: 'ABC123' })).id;
});

function newParent(overrides: { displayName?: string; email?: string; familyId?: number } = {}) {
  return createParent(pool, {
    familyId,
    displayName: 'Mom',
    email: 'mom@example.com',
    passwordHash: 'pw-hash',
    ...overrides,
  });
}

describe('creating users', () => {
  it('createParent returns a parent with no hash fields', async () => {
    const parent = await newParent();
    expect(parent).toMatchObject({ role: 'parent', familyId, email: 'mom@example.com' });
    expect(parent).not.toHaveProperty('passwordHash');
    expect(parent).not.toHaveProperty('pinHash');
  });

  it('createKid returns a kid with no hash fields', async () => {
    const kid = await createKid(pool, { familyId, displayName: 'Sam', pinHash: 'pin-hash' });
    expect(kid).toMatchObject({ role: 'kid', familyId, email: null });
    expect(kid).not.toHaveProperty('pinHash');
  });
});

describe('findUserById', () => {
  it('returns the user', async () => {
    const parent = await newParent();
    expect(await findUserById(pool, parent.id)).toEqual(parent);
  });

  it('returns null for an id that does not exist', async () => {
    expect(await findUserById(pool, 9999)).toBeNull();
  });
});

describe('findParentWithHashByEmail', () => {
  it('matches regardless of letter case and returns the hash', async () => {
    const parent = await newParent();
    const found = await findParentWithHashByEmail(pool, 'MOM@Example.COM');
    expect(found).toEqual({ ...parent, passwordHash: 'pw-hash' });
  });

  it('returns null for an unknown email', async () => {
    expect(await findParentWithHashByEmail(pool, 'nobody@example.com')).toBeNull();
  });
});

describe('uniqueness rules', () => {
  it('rejects a second parent with the same email in a different letter case', async () => {
    await newParent();
    await expect(
      newParent({ displayName: 'Dad', email: 'MOM@example.com' }),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects the same display name in one family, ignoring letter case', async () => {
    await createKid(pool, { familyId, displayName: 'Sam', pinHash: 'h1' });
    await expect(
      createKid(pool, { familyId, displayName: 'SAM', pinHash: 'h2' }),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('allows the same display name in two different families', async () => {
    const other = await createFamily(pool, { name: 'The Joneses', joinCode: 'XYZ789' });
    await createKid(pool, { familyId, displayName: 'Sam', pinHash: 'h1' });
    await expect(
      createKid(pool, { familyId: other.id, displayName: 'Sam', pinHash: 'h2' }),
    ).resolves.toMatchObject({ displayName: 'Sam', familyId: other.id });
  });
});

describe('role check constraint', () => {
  it('rejects a parent row that has a pin_hash', async () => {
    await expect(
      pool.query(
        `INSERT INTO users (family_id, role, display_name, email, password_hash, pin_hash)
         VALUES ($1, 'parent', 'Mom', 'mom@example.com', 'pw', 'pin')`,
        [familyId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects a kid row that has an email', async () => {
    await expect(
      pool.query(
        `INSERT INTO users (family_id, role, display_name, email, pin_hash)
         VALUES ($1, 'kid', 'Sam', 'sam@example.com', 'pin')`,
        [familyId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});

describe('cascade delete', () => {
  it('deleting a family deletes its users', async () => {
    const parent = await newParent();
    await pool.query('DELETE FROM families WHERE id = $1', [familyId]);
    expect(await findUserById(pool, parent.id)).toBeNull();
  });
});
