'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { postAuth } from '../authClient';
import { Button, ErrorNote, TextInput } from '../primitives';

export interface DeleteAccountViewProps {
  confirming: boolean;
  password: string;
  understood: boolean;
  busy: boolean;
  error: string | null;
  onStart: () => void;
  onCancel: () => void;
  onPassword: (value: string) => void;
  onUnderstood: (value: boolean) => void;
  onSubmit: () => void;
}

export function DeleteAccountView(props: DeleteAccountViewProps): React.JSX.Element {
  return (
    <section
      aria-label="Delete my account"
      className="flex flex-col gap-3 rounded-xl border border-berry bg-white p-4"
    >
      <h2 className="text-base font-semibold text-berry">Delete my account</h2>
      <p className="text-sm text-navy">
        This permanently deletes your profile, classes, free windows, notifications, wallet and all
        of your orders, past and present. It cannot be undone.
      </p>
      {props.confirming ? (
        <div className="flex flex-col gap-3" data-delete-confirm>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Confirm with your password</span>
            <TextInput
              type="password"
              autoComplete="current-password"
              data-delete-password
              value={props.password}
              onChange={(event) => props.onPassword(event.target.value)}
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              data-delete-understand
              checked={props.understood}
              onChange={(event) => props.onUnderstood(event.target.checked)}
              className="mt-0.5"
            />
            <span>I understand that everything above is deleted and cannot be recovered.</span>
          </label>
          <ErrorNote message={props.error} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              data-delete-submit
              disabled={props.busy || props.password === '' || !props.understood}
              onClick={props.onSubmit}
              className="bg-berry hover:bg-berry"
            >
              {props.busy ? 'Deleting…' : 'Yes, delete everything'}
            </Button>
            <Button type="button" tone="quiet" data-delete-cancel onClick={props.onCancel}>
              Keep my account
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button type="button" tone="quiet" data-delete-start onClick={props.onStart}>
            Delete my account
          </Button>
        </div>
      )}
    </section>
  );
}

export function DeleteAccount(): React.JSX.Element {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset(): void {
    setConfirming(false);
    setPassword('');
    setUnderstood(false);
    setError(null);
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await postAuth('delete-user', { password });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <DeleteAccountView
      confirming={confirming}
      password={password}
      understood={understood}
      busy={busy}
      error={error}
      onStart={() => setConfirming(true)}
      onCancel={reset}
      onPassword={setPassword}
      onUnderstood={setUnderstood}
      onSubmit={() => void submit()}
    />
  );
}
