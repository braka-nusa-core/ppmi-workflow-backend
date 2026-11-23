import 'dotenv/config';

/**
 * Points the app at the test database, and refuses to run anywhere else.
 *
 * The integration tests create rows and never clean up after themselves, so
 * they must not touch the development or production database. Two checks:
 *   1. TEST_DATABASE_URL must differ from DATABASE_URL.
 *   2. The database name must contain "test".
 */
const testUrl = process.env.TEST_DATABASE_URL;

if (testUrl) {
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL is the same as DATABASE_URL. Use a separate test database.',
    );
  }

  const databaseName = new URL(testUrl).pathname.replace(/^\//, '');
  if (!/test/i.test(databaseName)) {
    throw new Error(
      `Refusing to run integration tests on database "${databaseName}": its name must contain "test".`,
    );
  }

  process.env.DATABASE_URL = testUrl;
}
