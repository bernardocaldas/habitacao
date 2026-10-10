import { defineConfig } from 'vitest/config';

// `npm run balance`: plays many seeded games with scripted strategies and prints outcomes.
export default defineConfig({
  test: { include: ['scripts/*.test.ts'], testTimeout: 600_000, disableConsoleIntercept: true },
});
