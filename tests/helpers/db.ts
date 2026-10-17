import { pool } from '../../src/db.js';

// Empties every table except dbmate's bookkeeping and restarts ids at 1.
export async function resetDb(): Promise<void> {
  const { rows } = await pool.query<{ name: string }>('SELECT current_database() AS name');
  if (!rows[0].name.endsWith('_test')) {
    throw new Error(`resetDb refused to run on database "${rows[0].name}"`);
  }

  await pool.query(`
    DO $$
    DECLARE tables text;
    BEGIN
      SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
        INTO tables
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> 'schema_migrations';
      IF tables IS NOT NULL THEN
        EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE';
      END IF;
    END $$;
  `);
}
