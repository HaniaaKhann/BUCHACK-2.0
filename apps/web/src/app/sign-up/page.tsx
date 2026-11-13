import Link from 'next/link';
import { redirect } from 'next/navigation';
import { APP_NAME, APP_TAGLINE } from '@/brand';
import { getPageActor } from '@/server/session';
import { SignUpForm } from '@/ui/SignUpForm';

export const dynamic = 'force-dynamic';

export default async function SignUpPage(): Promise<React.JSX.Element> {
  if (await getPageActor()) redirect('/');
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="text-sm text-neutral-700">{APP_TAGLINE}</p>
      </header>
      <h2 className="text-lg font-semibold">Create your account</h2>
      <SignUpForm />
      <p className="text-sm">
        Already have an account?{' '}
        <Link href="/sign-in" className="underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
