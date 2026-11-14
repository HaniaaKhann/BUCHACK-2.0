import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPageActor } from '@/server/session';
import { AuthShell } from '@/ui/AuthShell';
import { SignInForm } from '@/ui/SignInForm';

export const dynamic = 'force-dynamic';

export default async function SignInPage(): Promise<React.JSX.Element> {
  if (await getPageActor()) redirect('/');
  return (
    <AuthShell title="Sign in">
      <SignInForm />
      <p className="text-sm">
        New here?{' '}
        <Link href="/sign-up" className="underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
