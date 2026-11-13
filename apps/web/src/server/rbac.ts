import { getAuth } from './auth';
import { prisma } from './db';

export type AppRole = 'student' | 'vendor_staff' | 'vendor_owner' | 'admin';
export type VendorMemberRole = 'owner' | 'staff';

export interface Actor {
  userId: string;
  email: string;
  role: AppRole;
}

export type Guard<T> = { ok: true; value: T } | { ok: false; response: Response };

const APP_ROLES: readonly string[] = ['student', 'vendor_staff', 'vendor_owner', 'admin'];

export function parseRole(value: unknown): AppRole | null {
  return typeof value === 'string' && APP_ROLES.includes(value) ? (value as AppRole) : null;
}

export function isRoleAllowed(role: AppRole, allowed: readonly AppRole[]): boolean {
  return allowed.includes(role);
}

export function canActOnVendor(
  role: AppRole,
  membership: VendorMemberRole | null,
  ownerOnly: boolean,
): boolean {
  if (role !== 'vendor_owner' && role !== 'vendor_staff') return false;
  if (membership === null) return false;
  return !ownerOnly || membership === 'owner';
}

function deny(status: 401 | 403, error: string): { ok: false; response: Response } {
  return { ok: false, response: Response.json({ error }, { status }) };
}

export async function requireRole(
  request: Request,
  allowed: readonly AppRole[],
): Promise<Guard<Actor>> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return deny(401, 'unauthenticated');

  const role = parseRole(session.user['role']);
  if (!role || !isRoleAllowed(role, allowed)) return deny(403, 'forbidden');

  return { ok: true, value: { userId: session.user.id, email: session.user.email, role } };
}

export async function requireVendorAccess(
  request: Request,
  vendorId: string,
  options: { ownerOnly?: boolean } = {},
): Promise<Guard<Actor>> {
  const actor = await requireRole(request, ['vendor_owner', 'vendor_staff']);
  if (!actor.ok) return actor;

  const member = await prisma.vendorMember.findUnique({
    where: { userId_vendorId: { userId: actor.value.userId, vendorId } },
    select: { role: true },
  });

  if (!canActOnVendor(actor.value.role, member?.role ?? null, options.ownerOnly ?? false)) {
    return deny(403, 'forbidden');
  }
  return actor;
}
