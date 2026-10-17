import { afterAll } from 'vitest';
import { pool } from '../../src/db.js';

// Each test file gets its own module instance, so close its pool when it finishes.
afterAll(async () => {
  await pool.end();
});
