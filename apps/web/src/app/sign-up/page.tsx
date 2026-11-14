import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPageActor } from '@/server/session';
import { AuthShell } from '@/ui/AuthShell';
import { SignUpForm } from '@/ui/SignUpForm';

export const dynamic = 'force-dynamic';

export default async function SignUpPage(): Promise<React.JSX.Element> {
  if (await getPageActor()) redirect('/');
  return (
    <AuthShell title="Create your account">
      <SignUpForm />
      <p className="text-sm">
        Already have an account?{' '}
        <Link href="/sign-in" className="underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
