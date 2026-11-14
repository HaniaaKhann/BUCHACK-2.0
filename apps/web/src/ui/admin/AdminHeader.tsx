import Link from 'next/link';
import { SignOutButton } from '../SignOutButton';

export function AdminHeader({ current }: { current: 'clock' | 'accuracy' }): React.JSX.Element {
  const link = (active: boolean): string =>
    `text-sm font-medium ${active ? 'underline' : 'text-neutral-600 hover:underline'}`;
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <nav className="flex items-center gap-5">
          <Link href="/admin" className={link(current === 'clock')}>
            Demo clock
          </Link>
          <Link href="/admin/accuracy" className={link(current === 'accuracy')}>
            Accuracy
          </Link>
        </nav>
        <SignOutButton />
      </div>
    </header>
  );
}
