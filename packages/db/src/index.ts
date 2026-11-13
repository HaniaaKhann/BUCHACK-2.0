export const DB_PACKAGE = '@app/db' as const;

export { PrismaClient } from '@prisma/client';
export {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  DEMO_VENDOR_NAME,
  isDemoEmail,
  seedDemoAccounts,
} from './seed/accounts.js';
export type { DemoAccount } from './seed/accounts.js';
export { openingHoursSchema } from './openingHours.js';
export { ACTIVE_VENDOR_WHERE } from './vendorVisibility.js';
export {
  isStaleSnapshot,
  readSnapshotPayload,
  snapshotPayloadSchema,
  toWaitSnapshot,
} from './snapshotPayload.js';
export type {
  SnapshotPayload,
  StoredSnapshotPayload,
  WaitSnapshotData,
} from './snapshotPayload.js';
export { SIM_EMAIL_DOMAIN } from './seed/simUsers.js';
