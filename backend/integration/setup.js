import 'dotenv/config';

// Never allow the automated test suite to use the demo database.
if (process.env.NODE_ENV === 'production') {
  throw new Error('Tests cannot run in production mode.');
}

const testDatabaseUrl =
  process.env.LEDGERLINE_TEST_DATABASE_URL ||
  'postgresql://postgres:postgrespassword@localhost:5432/ledgerline_test?schema=public';

const parsedUrl = new URL(testDatabaseUrl);

if (parsedUrl.pathname !== '/ledgerline_test') {
  throw new Error(
    'Safety check failed: the test database must be named ledgerline_test.'
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = 'test';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('A valid JWT_SECRET must be available from your backend .env file.');
}

console.log('[LedgerLine Tests] Test database configured: ledgerline_test');
