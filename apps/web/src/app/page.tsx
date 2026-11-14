import { GOAL_OPTIONS } from '@app/core';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { APP_NAME } from '@/brand';
import { prisma } from '@/server/db';
import { loadMenu, loadVendorList } from '@/server/menuService';
import { getPageActor } from '@/server/session';
import { AuthShell } from '@/ui/AuthShell';
import { CartProvider } from '@/ui/cart/CartProvider';
import { Dashboard } from '@/ui/dashboard/Dashboard';
import { SignOutButton } from '@/ui/SignOutButton';

export const dynamic = 'force-dynamic';

export default async function HomePage(): Promise<React.JSX.Element> {
  const actor = await getPageActor();

  if (!actor) {
    return (
      <AuthShell title="Get started">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/sign-in" className="rounded-md bg-neutral-900 px-4 py-2 text-white">
            Sign in
          </Link>
          <Link href="/sign-up" className="rounded-md border border-neutral-300 px-4 py-2">
            Create an account
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (actor.role === 'student') {
    const [menu, vendors, buildings, profile] = await Promise.all([
      loadMenu(actor.userId, new URLSearchParams()),
      loadVendorList(actor.userId),
      prisma.building.findMany({
        orderBy: [{ campus: 'asc' }, { name: 'asc' }],
        select: { id: true, campus: true, name: true },
      }),
      prisma.studentProfile.findUnique({ where: { userId: actor.userId } }),
    ]);
    if (menu.status !== 200 || profile === null) redirect('/onboarding');
    return (
      <CartProvider>
        <Dashboard
          initialMenu={menu.body}
          initialVendors={vendors}
          buildings={buildings}
          currentBuildingId={profile.currentBuildingId}
          profile={{
            dietTags: profile.dietTags,
            allergens: profile.allergens,
            goal: GOAL_OPTIONS.find((goal) => goal === profile.goal) ?? null,
          }}
        />
      </CartProvider>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
      <p className="text-sm text-neutral-700">Signed in as {actor.email}.</p>
      <p className="text-sm">This screen for your role arrives in a later milestone.</p>
      <div>
        <SignOutButton />
      </div>
    </main>
  );
}
