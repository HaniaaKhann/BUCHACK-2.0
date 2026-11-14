import type { ReactNode } from 'react';
import { APP_NAME, APP_TAGLINE } from '@/brand';

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:min-h-[70vh] lg:grid-cols-2 lg:items-center lg:gap-14 lg:py-16">
      <header className="flex animate-fade-up flex-col gap-4 rounded-2xl bg-navy p-6 text-cream lg:p-12">
        <span data-logo-slot aria-hidden="true" className="block h-10 w-10 shrink-0" />
        <h1 className="text-4xl font-bold tracking-tight lg:text-6xl">{APP_NAME}</h1>
        <p className="text-base lg:text-xl">{APP_TAGLINE}</p>
        <div className="mt-2 h-1.5 w-20 origin-left animate-grow rounded-full bg-sky" />
      </header>
      <section
        className="flex w-full max-w-md animate-fade-up flex-col gap-5 rounded-2xl border border-navy/15 bg-white p-6 shadow-sm lg:justify-self-end"
        style={{ animationDelay: '150ms' }}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </section>
    </main>
  );
}
