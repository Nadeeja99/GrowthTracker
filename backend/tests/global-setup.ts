import { execSync } from 'child_process';
import { testDatabaseUrl } from './test-db';

// Production databases run in UTC, which hides SQL that depends on the
// session's time zone (a date compared with a timestamp shifts by a day
// elsewhere). The test database runs far from UTC so such bugs fail here.
const TEST_DATABASE_TIMEZONE = 'Pacific/Kiritimati'; // UTC+14

export default function globalSetup() {
  const url = testDatabaseUrl();
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env });
  execSync('npx prisma db execute --stdin --schema prisma/schema.prisma', {
    stdio: ['pipe', 'inherit', 'inherit'],
    env,
    input: `DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), '${TEST_DATABASE_TIMEZONE}'); END $$;`,
  });
}
