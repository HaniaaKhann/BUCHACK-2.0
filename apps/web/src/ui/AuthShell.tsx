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
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:min-h-[70vh] lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-16">
      <header className="flex animate-fade-up flex-col gap-4">
        <span
          data-logo-slot
          data-logo-hero
          aria-hidden="true"
          className="h-32 w-32 shrink-0 lg:h-44 lg:w-44"
        />
        <h1 data-hero-name className="text-4xl font-bold tracking-tight text-navy lg:text-5xl">
          {APP_NAME}
        </h1>
        <p className="max-w-sm text-base text-navy lg:text-lg">{APP_TAGLINE}</p>
        <div className="h-0.5 w-12 origin-left animate-grow bg-sky" />
      </header>
      <section
        className="flex w-full max-w-md animate-fade-up flex-col gap-5 rounded-2xl border border-navy/10 bg-white p-6 shadow-[0_8px_30px_rgba(56,70,113,0.10)] lg:justify-self-end"
        style={{ animationDelay: '150ms' }}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </section>
    </main>
  );
}
