import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DeleteAccountView, type DeleteAccountViewProps } from '../src/ui/account/DeleteAccount';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const noop = (): void => undefined;

function view(overrides: Partial<DeleteAccountViewProps> = {}): string {
  return renderToStaticMarkup(
    <DeleteAccountView
      confirming={false}
      password=""
      understood={false}
      busy={false}
      error={null}
      onStart={noop}
      onCancel={noop}
      onPassword={noop}
      onUnderstood={noop}
      onSubmit={noop}
      {...overrides}
    />,
  );
}

describe('DeleteAccountView', () => {
  it('starts with only a button and says what will be deleted', () => {
    const html = view();
    expect(html).toContain('data-delete-start');
    expect(html).not.toContain('data-delete-confirm');
    expect(html).not.toContain('data-delete-password');
    for (const word of ['profile', 'free windows', 'notifications', 'wallet', 'orders']) {
      expect(html).toContain(word);
    }
    expect(html).toContain('cannot be undone');
  });

  it('asks for the password and an explicit tick before the final button works', () => {
    const html = view({ confirming: true });
    expect(html).toContain('data-delete-confirm');
    expect(html).toContain('data-delete-password');
    expect(html).toContain('data-delete-understand');
    expect(html).toMatch(
      /data-delete-submit="true"[^>]*disabled=""|disabled=""[^>]*data-delete-submit="true"/,
    );
    expect(html).toContain('Keep my account');
  });

  it('enables the final button once both are given, and shows an error from the server', () => {
    const ready = view({ confirming: true, password: 'secret', understood: true });
    expect(ready).not.toMatch(/data-delete-submit="true"[^>]*disabled=""/);
    const failed = view({ confirming: true, error: 'Demo accounts cannot be deleted' });
    expect(failed).toContain('Demo accounts cannot be deleted');
  });
});
