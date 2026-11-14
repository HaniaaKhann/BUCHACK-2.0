import { grantStartingCredit, isDemoEmail } from '@app/db';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError } from 'better-auth/api';
import { rateLimitOptions } from './authRateLimit';
import { ACTIVE_ORDER_STATUSES } from './orderStatuses';
import { prisma } from './db';

function createAuth() {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: { enabled: true },
    ...rateLimitOptions(process.env['DEMO_MODE']),
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const role = (user as { role?: string }).role;
            if (role === undefined || role === 'student')
              await grantStartingCredit(prisma, user.id);
          },
        },
      },
    },
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'student', input: false },
      },
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          if (isDemoEmail(user.email)) {
            throw new APIError('FORBIDDEN', { message: 'Demo accounts cannot be deleted' });
          }
          const active = await prisma.order.count({
            where: { studentId: user.id, status: { in: [...ACTIVE_ORDER_STATUSES] } },
          });
          if (active > 0) {
            throw new APIError('CONFLICT', {
              message: 'Finish or cancel your active orders before deleting your account',
            });
          }
        },
      },
    },
  });
}

type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
