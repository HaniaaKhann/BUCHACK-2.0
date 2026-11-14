import Image from 'next/image';
import type { ReactNode } from 'react';
import { APP_NAME, APP_TAGLINE } from '@/brand';
import { campusPhotoExists } from '@/server/assets';

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <main className="flex min-h-[80vh] items-center justify-center px-3 py-6 sm:px-6 sm:py-10">
      <div
        aria-hidden="true"
        data-auth-backdrop
        className="fixed inset-0 -z-10 bg-gradient-to-b from-navy to-navy/80"
      >
        {campusPhotoExists() ? (
          <Image
            src="/campus/hkbu-landing.jpg"
            alt=""
            fill
            priority
            quality={70}
            sizes="100vw"
            className="object-cover object-center"
          />
        ) : null}
        <div className="absolute inset-0 bg-navy/60" />
      </div>
      <div
        data-auth-card
        className="flex w-full max-w-[420px] animate-fade-up flex-col gap-5 rounded-2xl bg-white p-5 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.5),0_4px_16px_rgba(0,0,0,0.25)] sm:p-7"
      >
        <header className="flex flex-col items-center gap-3 text-center">
          <span
            data-logo-slot
            data-logo-hero
            aria-hidden="true"
            className="h-52 w-52 shrink-0 sm:h-60 sm:w-60"
          />
          <h1 data-hero-name className="text-4xl font-bold tracking-tight text-navy">
            {APP_NAME}
          </h1>
          <p className="text-lg font-bold italic text-navy sm:text-xl">{APP_TAGLINE}</p>
        </header>
        <hr className="border-navy/10" />
        <section className="flex flex-col gap-5 [&>p]:text-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          {children}
        </section>
      </div>
    </main>
  );
}
