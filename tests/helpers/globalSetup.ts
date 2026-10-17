import { execFileSync } from 'node:child_process';
import { getTestDatabaseUrl } from './testDatabaseUrl.js';

// Creates appdb_test if missing and applies pending migrations.
export default function setup() {
  const url = getTestDatabaseUrl();
  // --url keeps dbmate off the dev DATABASE_URL it would otherwise load from .env.
  execFileSync('npx', ['dbmate', '--url', url, '--no-dump-schema', 'up'], {
    stdio: 'inherit',
  });
}
