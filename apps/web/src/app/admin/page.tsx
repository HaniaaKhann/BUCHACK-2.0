import { redirect } from 'next/navigation';
import { getClockView } from '@/server/clockAdmin';
import { getPageActor } from '@/server/session';
import { AdminHeader } from '@/ui/admin/AdminHeader';
import { ClockPanel } from '@/ui/admin/ClockPanel';

export const dynamic = 'force-dynamic';

export default async function AdminPage(): Promise<React.JSX.Element> {
  const actor = await getPageActor();
  if (!actor) redirect('/sign-in');
  if (actor.role !== 'admin') redirect('/');

  return (
    <div className="min-h-screen bg-cream">
      <AdminHeader current="clock" />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:py-6">
        <h1 className="text-xl font-semibold">Demo clock</h1>
        <ClockPanel initial={await getClockView()} />
      </main>
    </div>
  );
}
