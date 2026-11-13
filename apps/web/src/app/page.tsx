import Link from 'next/link';
import { redirect } from 'next/navigation';
import { APP_NAME, APP_TAGLINE } from '@/brand';
import { prisma } from '@/server/db';
import { getPageActor } from '@/server/session';
import { SignOutButton } from '@/ui/SignOutButton';

export const dynamic = 'force-dynamic';

export default async function HomePage(): Promise<React.JSX.Element> {
  const actor = await getPageActor();

  if (!actor) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
        <h1 className="text-4xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="text-neutral-700">{APP_TAGLINE}</p>
        <div className="flex gap-3 text-sm">
          <Link href="/sign-in" className="rounded-md bg-neutral-900 px-4 py-2 text-white">
            Sign in
          </Link>
          <Link href="/sign-up" className="rounded-md border border-neutral-300 px-4 py-2">
            Create an account
          </Link>
        </div>
      </main>
    );
  }

  if (actor.role === 'student') {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: actor.userId },
      select: { userId: true },
    });
    if (profile === null) redirect('/onboarding');
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
      <p className="text-sm text-neutral-700">Signed in as {actor.email}.</p>
      {actor.role === 'student' ? (
        <p className="text-sm">Your profile is saved. The ranked home arrives in the next step.</p>
      ) : (
        <p className="text-sm">This screen for your role arrives in a later milestone.</p>
      )}
      <div className="flex gap-3">
        {actor.role === 'student' ? (
          <Link
            href="/onboarding"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm"
          >
            Edit profile
          </Link>
        ) : null}
        <SignOutButton />
      </div>
    </main>
  );
}
