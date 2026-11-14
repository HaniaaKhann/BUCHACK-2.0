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
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:min-h-[70vh] lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight lg:text-5xl">{APP_NAME}</h1>
        <p className="text-base text-neutral-700 lg:text-lg">{APP_TAGLINE}</p>
        <ul className="mt-4 hidden flex-col gap-2 text-sm text-neutral-700 lg:flex">
          <li>See what is ready before your next class, not just what is nearby.</li>
          <li>Wait ranges come from simulated demo data and say so.</li>
          <li>A diet tag only counts once the vendor has confirmed it.</li>
        </ul>
      </header>
      <section className="flex w-full max-w-md flex-col gap-5 lg:justify-self-end">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </section>
    </main>
  );
}
