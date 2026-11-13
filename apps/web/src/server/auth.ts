import { isDemoEmail } from '@app/db';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError } from 'better-auth/api';
import { prisma } from './db';

function createAuth() {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: { enabled: true },
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
