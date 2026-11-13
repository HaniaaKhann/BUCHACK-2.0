export const DB_PACKAGE = '@app/db' as const;

export { PrismaClient } from '@prisma/client';
export { DEMO_ACCOUNTS, DEMO_PASSWORD, isDemoEmail, seedDemoAccounts } from './seed/accounts.js';
export type { DemoAccount } from './seed/accounts.js';
export { SIM_EMAIL_DOMAIN } from './seed/simUsers.js';
