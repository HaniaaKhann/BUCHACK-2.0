import type { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

export const DEMO_PASSWORD = 'demo-password-1';
export const DEMO_VENDOR_NAME = 'Bistro NTT';

export interface DemoAccount {
  id: string;
  email: string;
  name: string;
  role: Role;
  vendorMemberRole: 'owner' | 'staff' | null;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: 'demo-student',
    email: 'student@demo.example',
    name: 'Demo Student',
    role: 'student',
    vendorMemberRole: null,
  },
  {
    id: 'demo-vendor-owner',
    email: 'owner@demo.example',
    name: 'Demo Vendor Owner',
    role: 'vendor_owner',
    vendorMemberRole: 'owner',
  },
  {
    id: 'demo-vendor-staff',
    email: 'staff@demo.example',
    name: 'Demo Vendor Staff',
    role: 'vendor_staff',
    vendorMemberRole: 'staff',
  },
  {
    id: 'demo-admin',
    email: 'admin@demo.example',
    name: 'Demo Admin',
    role: 'admin',
    vendorMemberRole: null,
  },
];

export function isDemoEmail(email: string): boolean {
  const lowered = email.toLowerCase();
  return DEMO_ACCOUNTS.some((account) => account.email === lowered);
}

export async function seedDemoAccounts(db: PrismaClient): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const vendor = await db.vendor.findUnique({
    where: { name: DEMO_VENDOR_NAME },
    select: { id: true },
  });

  for (const account of DEMO_ACCOUNTS) {
    const user = await db.user.upsert({
      where: { email: account.email },
      create: {
        id: account.id,
        email: account.email,
        name: account.name,
        role: account.role,
        emailVerified: true,
      },
      update: { name: account.name, role: account.role, emailVerified: true },
    });

    await db.account.upsert({
      where: { id: `${user.id}-credential` },
      create: {
        id: `${user.id}-credential`,
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password: passwordHash,
      },
      update: { password: passwordHash },
    });

    if (account.vendorMemberRole && vendor) {
      await db.vendorMember.deleteMany({
        where: { userId: user.id, vendorId: { not: vendor.id } },
      });
      await db.vendorMember.upsert({
        where: { userId_vendorId: { userId: user.id, vendorId: vendor.id } },
        create: { userId: user.id, vendorId: vendor.id, role: account.vendorMemberRole },
        update: { role: account.vendorMemberRole },
      });
    }
  }
}
