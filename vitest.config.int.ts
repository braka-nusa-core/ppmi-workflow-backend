import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests run against a real, migrated PostgreSQL database that is
// reserved for tests. They are skipped unless TEST_DATABASE_URL is set.
// See test/integration/setup.ts for the safety checks.
export default defineConfig({
  test: {
    include: ['test/integration/**/*.int-spec.ts'],
    setupFiles: ['test/integration/setup.ts'],
    globals: true,
    root: './',
    environment: 'node',
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  plugins: [swc.vite()],
});
