import { redirect } from 'next/navigation';
import { loadInAppAccuracy, loadSimulatedAccuracy } from '@/server/accuracy';
import { getPageActor } from '@/server/session';
import { AccuracyView } from '@/ui/admin/AccuracyView';
import { AdminHeader } from '@/ui/admin/AdminHeader';

export const dynamic = 'force-dynamic';

export default async function AccuracyPage(): Promise<React.JSX.Element> {
  const actor = await getPageActor();
  if (!actor) redirect('/sign-in');
  if (actor.role !== 'admin') redirect('/');

  const [simulated, inApp] = await Promise.all([loadSimulatedAccuracy(), loadInAppAccuracy()]);

  return (
    <div className="min-h-screen bg-paper">
      <AdminHeader current="accuracy" />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:py-6">
        <h1 className="text-xl font-semibold">Wait time accuracy</h1>
        <AccuracyView simulated={simulated} inApp={inApp} />
      </main>
    </div>
  );
}
