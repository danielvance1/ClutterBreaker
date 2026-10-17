import { beforeEach, describe, expect, it } from 'vitest';
import { pool, withTransaction } from '../src/db.js';
import { createFamily } from '../src/repos/families.js';
import { resetDb } from './helpers/db.js';

beforeEach(resetDb);

const count = async () =>
  (await pool.query('SELECT count(*)::int AS n FROM families')).rows[0].n as number;

describe('withTransaction', () => {
  it('commits and returns the result when the callback succeeds', async () => {
    const result = await withTransaction(async (client) => {
      await createFamily(client, { name: 'A', joinCode: 'AAAAAAAA' });
      return 'done';
    });
    expect(result).toBe('done');
    expect(await count()).toBe(1);
  });

  it('rolls back and rethrows when the callback throws', async () => {
    await expect(
      withTransaction(async (client) => {
        await createFamily(client, { name: 'A', joinCode: 'AAAAAAAA' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await count()).toBe(0);
  });

  it('releases the connection after a failure', async () => {
    const before = pool.totalCount - pool.idleCount;
    await withTransaction(async () => {
      throw new Error('boom');
    }).catch(() => {});
    expect(pool.totalCount - pool.idleCount).toBe(before);
  });
});
