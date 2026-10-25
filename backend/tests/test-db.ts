// Tests truncate every table, so they must never point at a real database.
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('Set TEST_DATABASE_URL to a disposable Postgres database (its name must end in "_test").');
  }
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run tests against "${dbName}": the database name must end in "_test".`);
  }
  return url;
}
