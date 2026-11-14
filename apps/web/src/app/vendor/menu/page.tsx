import { redirect } from 'next/navigation';
import { getPageActor } from '@/server/session';
import { listVendorMenu } from '@/server/vendorControls';
import { getVendorContext } from '@/server/vendorContext';
import { VendorMenu } from '@/ui/vendor/VendorMenu';

export const dynamic = 'force-dynamic';

export default async function VendorMenuPage(): Promise<React.JSX.Element> {
  const actor = await getPageActor();
  if (!actor) redirect('/sign-in');
  const context = await getVendorContext(actor);
  if (context === null) redirect('/');

  return (
    <VendorMenu
      vendorId={context.vendorId}
      initialItems={await listVendorMenu(context.vendorId)}
      isOwner={context.memberRole === 'owner'}
    />
  );
}
