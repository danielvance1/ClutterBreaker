const DEFAULT_TEST_DATABASE_URL =
  'postgres://app:devpassword@localhost:5432/appdb_test?sslmode=disable';

// Tests truncate tables, so refuse to run against anything not named *_test.
export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests: database name "${dbName}" does not end in "_test". ` +
        'Check TEST_DATABASE_URL.',
    );
  }
  return url;
}
