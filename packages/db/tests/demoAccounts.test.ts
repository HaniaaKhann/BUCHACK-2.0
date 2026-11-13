import { describe, expect, it } from 'vitest';
import { DEMO_ACCOUNTS, isDemoEmail } from '../src/seed/accounts.js';

describe('demo accounts', () => {
  it('covers all four roles with distinct emails and ids', () => {
    expect(new Set(DEMO_ACCOUNTS.map((a) => a.role))).toEqual(
      new Set(['student', 'vendor_owner', 'vendor_staff', 'admin']),
    );
    expect(new Set(DEMO_ACCOUNTS.map((a) => a.email)).size).toBe(4);
    expect(new Set(DEMO_ACCOUNTS.map((a) => a.id)).size).toBe(4);
  });

  it('gives only vendor roles a vendor membership', () => {
    for (const account of DEMO_ACCOUNTS) {
      const isVendorRole = account.role === 'vendor_owner' || account.role === 'vendor_staff';
      expect(account.vendorMemberRole !== null).toBe(isVendorRole);
    }
  });

  it('recognises demo emails case-insensitively', () => {
    expect(isDemoEmail('Student@Demo.Example')).toBe(true);
    expect(isDemoEmail('someone@else.example')).toBe(false);
  });
});
