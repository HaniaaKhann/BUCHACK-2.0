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
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 px-4 py-10 sm:px-6 lg:py-14">
      <header className="flex animate-fade-up flex-col items-center gap-4 text-center">
        <span
          data-logo-slot
          data-logo-hero
          aria-hidden="true"
          className="h-52 w-52 shrink-0 sm:h-64 sm:w-64 lg:h-72 lg:w-72"
        />
        <h1 data-hero-name className="text-5xl font-bold tracking-tight text-navy lg:text-6xl">
          {APP_NAME}
        </h1>
        <p className="max-w-md text-xl font-bold italic text-navy lg:text-2xl">{APP_TAGLINE}</p>
      </header>
      <section
        className="flex w-full max-w-md animate-fade-up flex-col gap-5 rounded-2xl border border-navy/10 bg-white p-6 shadow-[0_8px_30px_rgba(56,70,113,0.10)]"
        style={{ animationDelay: '150ms' }}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </section>
    </main>
  );
}
