import { afterEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/db.js';
import { createFamily } from '../../src/repos/families.js';
import { resetDb } from './db.js';
import { getTestDatabaseUrl } from './testDatabaseUrl.js';

describe('resetDb', () => {
  it('empties the tables and restarts ids at 1', async () => {
    await createFamily(pool, { name: 'First', joinCode: 'AAA' });
    await createFamily(pool, { name: 'Second', joinCode: 'BBB' });

    await resetDb();

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM families');
    expect(rows[0].n).toBe(0);
    const family = await createFamily(pool, { name: 'Third', joinCode: 'CCC' });
    expect(family.id).toBe(1);
  });
});

describe('test database guard', () => {
  const original = process.env.TEST_DATABASE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = original;
  });

  it('throws when the database name does not end in _test', () => {
    process.env.TEST_DATABASE_URL = 'postgres://app:devpassword@localhost:5432/appdb';
    expect(() => getTestDatabaseUrl()).toThrow(/does not end in "_test"/);
  });
});
