import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db.js';
import { createFamily, findFamilyByJoinCode } from '../../src/repos/families.js';
import { resetDb } from '../helpers/db.js';

beforeEach(resetDb);

describe('families repo', () => {
  it('creates a family with an id and a createdAt', async () => {
    const family = await createFamily(pool, { name: 'The Smiths', joinCode: 'ABC123' });
    expect(family.id).toBeTypeOf('number');
    expect(family.createdAt).toBeInstanceOf(Date);
    expect(family).toMatchObject({ name: 'The Smiths', joinCode: 'ABC123' });
  });

  it('finds a family by join code', async () => {
    const created = await createFamily(pool, { name: 'The Smiths', joinCode: 'ABC123' });
    expect(await findFamilyByJoinCode(pool, 'ABC123')).toEqual(created);
  });

  it('returns null for an unknown join code', async () => {
    expect(await findFamilyByJoinCode(pool, 'NOPE')).toBeNull();
  });

  it('rejects a second family with the same join code', async () => {
    await createFamily(pool, { name: 'The Smiths', joinCode: 'ABC123' });
    await expect(
      createFamily(pool, { name: 'The Joneses', joinCode: 'ABC123' }),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
