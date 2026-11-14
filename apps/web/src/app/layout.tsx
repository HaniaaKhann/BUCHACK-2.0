import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { APP_NAME, APP_TAGLINE } from '@/brand';
import { DemoBanner } from '@/ui/DemoBanner';
import './globals.css';

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#384671',
};

export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <html lang="en">
      <body className="min-h-screen bg-cream text-navy antialiased">
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
