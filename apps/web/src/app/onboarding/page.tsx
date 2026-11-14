import { GOAL_OPTIONS, type Goal } from '@app/core';
import { redirect } from 'next/navigation';
import { APP_NAME } from '@/brand';
import { prisma } from '@/server/db';
import { getPageActor } from '@/server/session';
import { DeleteAccount } from '@/ui/account/DeleteAccount';
import { OnboardingForm, type OnboardingInitial } from '@/ui/OnboardingForm';

export const dynamic = 'force-dynamic';

function asGoal(value: string | null): Goal {
  return GOAL_OPTIONS.find((goal) => goal === value) ?? 'none';
}

export default async function OnboardingPage(): Promise<React.JSX.Element> {
  const actor = await getPageActor();
  if (!actor) redirect('/sign-in');
  if (actor.role !== 'student') redirect('/');

  const [buildings, profile, savedClasses, gapCount] = await Promise.all([
    prisma.building.findMany({
      orderBy: [{ campus: 'asc' }, { name: 'asc' }],
      select: { id: true, campus: true, name: true },
    }),
    prisma.studentProfile.findUnique({ where: { userId: actor.userId } }),
    prisma.classEntry.findMany({
      where: { userId: actor.userId },
      orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      select: { weekday: true, startMinute: true, endMinute: true, buildingId: true },
    }),
    prisma.freeWindow.count({ where: { userId: actor.userId } }),
  ]);
  const initial: OnboardingInitial = {
    dietTags: profile?.dietTags ?? [],
    allergens: profile?.allergens ?? [],
    goal: asGoal(profile?.goal ?? null),
    eatMinutes: profile?.eatMinutes ?? 15,
    chatLanguage: profile?.chatLanguage ?? 'en',
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile === null ? `Welcome to ${APP_NAME}` : 'Your profile'}
        </h1>
        <p className="text-sm text-navy">
          {profile === null
            ? 'Everything here is optional and can be changed later.'
            : 'Change your settings, or delete your account at the bottom of this page.'}
        </p>
      </header>
      <OnboardingForm
        buildings={buildings}
        initial={initial}
        savedClasses={savedClasses}
        gapsWithoutClasses={savedClasses.length === 0 && gapCount > 0}
      />
      <DeleteAccount />
    </main>
  );
}
