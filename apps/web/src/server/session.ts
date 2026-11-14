import { headers } from 'next/headers';
import { getAuth } from './auth';
import { parseRole, type AppRole } from './rbac';

export interface PageActor {
  userId: string;
  email: string;
  name: string;
  role: AppRole;
}

export async function getPageActor(): Promise<PageActor | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = parseRole(session.user['role']);
  if (!role) return null;
  return { userId: session.user.id, email: session.user.email, name: session.user.name, role };
}
