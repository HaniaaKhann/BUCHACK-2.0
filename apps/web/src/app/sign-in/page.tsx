import Link from 'next/link';
import { redirect } from 'next/navigation';
import { APP_NAME, APP_TAGLINE } from '@/brand';
import { getPageActor } from '@/server/session';
import { SignInForm } from '@/ui/SignInForm';

export const dynamic = 'force-dynamic';

export default async function SignInPage(): Promise<React.JSX.Element> {
  if (await getPageActor()) redirect('/');
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="text-sm text-neutral-700">{APP_TAGLINE}</p>
      </header>
      <h2 className="text-lg font-semibold">Sign in</h2>
      <SignInForm />
      <p className="text-sm">
        New here?{' '}
        <Link href="/sign-up" className="underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
