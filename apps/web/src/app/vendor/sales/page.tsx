import { redirect } from 'next/navigation';
import { prisma } from '@/server/db';
import { loadSalesView } from '@/server/salesService';
import { getPageActor } from '@/server/session';
import { getVendorContext } from '@/server/vendorContext';
import { SalesDashboard } from '@/ui/vendor/SalesDashboard';

export const dynamic = 'force-dynamic';

export default async function SalesPage(): Promise<React.JSX.Element> {
  const actor = await getPageActor();
  if (!actor) redirect('/sign-in');
  const context = await getVendorContext(actor);
  if (context === null) redirect('/');
  if (context.memberRole !== 'owner') redirect('/vendor');

  const [view, vendor] = await Promise.all([
    loadSalesView(context.vendorId, 'today'),
    prisma.vendor.findUniqueOrThrow({ where: { id: context.vendorId }, select: { name: true } }),
  ]);
  return <SalesDashboard vendorId={context.vendorId} vendorName={vendor.name} initial={view} />;
}
