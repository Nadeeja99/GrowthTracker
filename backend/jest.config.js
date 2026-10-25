/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }] },
  // Runs in every test file before any import: test env vars, no .env loading.
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  // Applies migrations to the test database once per run.
  globalSetup: '<rootDir>/tests/global-setup.ts',
  // Files share one database and truncate it, so they run one at a time.
  maxWorkers: 1,
  testTimeout: 20000,
};
