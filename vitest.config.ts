import { defineConfig } from 'vitest/config';
import { getTestDatabaseUrl } from './tests/helpers/testDatabaseUrl.js';

export default defineConfig({
  test: {
    // Test files share one database, so they must run one at a time.
    fileParallelism: false,
    globalSetup: ['./tests/helpers/globalSetup.ts'],
    setupFiles: ['./tests/helpers/setup.ts'],
    // Set before src/db.ts creates its pool, so the app never sees the dev URL.
    env: { DATABASE_URL: getTestDatabaseUrl() },
  },
});
