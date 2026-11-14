import { redirect } from 'next/navigation';
import { getPageActor } from '@/server/session';
import { listVendorOrders } from '@/server/vendorService';
import { vendorStatus } from '@/server/vendorControls';
import { getVendorContext } from '@/server/vendorContext';
import { VendorBoard } from '@/ui/vendor/VendorBoard';

export const dynamic = 'force-dynamic';

export default async function VendorPage(): Promise<React.JSX.Element> {
  const actor = await getPageActor();
  if (!actor) redirect('/sign-in');
  const context = await getVendorContext(actor);
  if (context === null) redirect('/');

  const [orders, status] = await Promise.all([
    listVendorOrders(context.vendorId),
    vendorStatus(context.vendorId),
  ]);
  if (status === null) redirect('/');

  return (
    <VendorBoard
      vendorId={context.vendorId}
      initialOrders={orders}
      initialStatus={status}
      isOwner={context.memberRole === 'owner'}
    />
  );
}
