import { execSync } from 'child_process';
import { testDatabaseUrl } from './test-db';

export default function globalSetup() {
  const url = testDatabaseUrl();
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
