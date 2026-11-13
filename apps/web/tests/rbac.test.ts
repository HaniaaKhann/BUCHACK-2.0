import { describe, expect, it } from 'vitest';
import { canActOnVendor, isRoleAllowed, parseRole } from '../src/server/rbac';

describe('parseRole', () => {
  it('accepts the four app roles and rejects anything else', () => {
    expect(parseRole('student')).toBe('student');
    expect(parseRole('admin')).toBe('admin');
    expect(parseRole('superuser')).toBeNull();
    expect(parseRole(undefined)).toBeNull();
  });
});

describe('isRoleAllowed', () => {
  it('checks membership in the allowed list', () => {
    expect(isRoleAllowed('student', ['student'])).toBe(true);
    expect(isRoleAllowed('admin', ['student'])).toBe(false);
  });
});

describe('canActOnVendor', () => {
  it('requires a vendor role and a membership', () => {
    expect(canActOnVendor('vendor_staff', 'staff', false)).toBe(true);
    expect(canActOnVendor('vendor_owner', 'owner', false)).toBe(true);
    expect(canActOnVendor('vendor_owner', null, false)).toBe(false);
    expect(canActOnVendor('student', 'owner', false)).toBe(false);
    expect(canActOnVendor('admin', 'owner', false)).toBe(false);
  });

  it('lets only owners through owner-only actions', () => {
    expect(canActOnVendor('vendor_staff', 'staff', true)).toBe(false);
    expect(canActOnVendor('vendor_owner', 'owner', true)).toBe(true);
  });
});
