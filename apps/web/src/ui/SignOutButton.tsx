'use client';

import { useRouter } from 'next/navigation';
import { postAuth } from './authClient';
import { Button } from './primitives';

export function SignOutButton(): React.JSX.Element {
  const router = useRouter();

  async function signOut(): Promise<void> {
    await postAuth('sign-out', {});
    router.push('/sign-in');
    router.refresh();
  }

  return (
    <Button tone="quiet" type="button" onClick={signOut}>
      Sign out
    </Button>
  );
}
