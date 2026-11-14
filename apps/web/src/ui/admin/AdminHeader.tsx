import Link from 'next/link';
import { AppHeader } from '../primitives';
import { SignOutButton } from '../SignOutButton';

export function AdminHeader({ current }: { current: 'clock' | 'accuracy' }): React.JSX.Element {
  const link = (active: boolean): string =>
    `text-sm font-medium ${active ? 'underline' : 'hover:underline'}`;
  return (
    <AppHeader
      left={
        <nav className="flex items-center gap-5">
          <Link href="/admin" className={link(current === 'clock')}>
            Demo clock
          </Link>
          <Link href="/admin/accuracy" className={link(current === 'accuracy')}>
            Accuracy
          </Link>
        </nav>
      }
      right={<SignOutButton />}
    />
  );
}
