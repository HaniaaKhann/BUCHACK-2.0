import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

process.env['DATABASE_URL'] ??= 'postgresql://postgres:postgres@localhost:5432/app';

const databaseUrl = process.env['DATABASE_URL'] ?? '';
if (!databaseUrl.includes('connection_limit')) {
  process.env['DATABASE_URL'] =
    `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}connection_limit=3`;
}
process.env['BETTER_AUTH_SECRET'] ??= 'test-secret-not-for-production-use';
process.env['BETTER_AUTH_URL'] ??= 'http://localhost:3000';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    fileParallelism: false,
  },
});
