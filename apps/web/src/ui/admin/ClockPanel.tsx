'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ClockView } from '@/server/clockAdmin';
import { useLiveRefresh } from '../dashboard/useLiveRefresh';
import { Button, Card, ErrorNote } from '../primitives';

const SPEEDS = [0, 1, 10, 60] as const;
const JUMPS = [
  { minutes: 15, label: '+15 min' },
  { minutes: 60, label: '+1 hour' },
  { minutes: 1440, label: '+1 day' },
] as const;

type Command =
  | { kind: 'speed'; speed: number }
  | { kind: 'jump'; minutes: number }
  | { kind: 'set'; timeMs: number }
  | { kind: 'start' };

function formatHongKong(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Hong_Kong',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

function speedLabel(speed: number): string {
  return speed === 0 ? 'Paused' : `${speed}x`;
}

export function ClockPanel({ initial }: { initial: ClockView }): React.JSX.Element {
  const [clock, setClock] = useState(initial);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [shownMs, setShownMs] = useState(initial.nowMs);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFetchedAt(Date.now());
  }, [clock]);

  useEffect(() => {
    if (fetchedAt === null) return;
    const update = (): void => setShownMs(clock.nowMs + (Date.now() - fetchedAt) * clock.speed);
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [clock, fetchedAt]);

  const refresh = useCallback(async (): Promise<void> => {
    const response = await fetch('/api/admin/clock', { cache: 'no-store' });
    if (response.ok) setClock(((await response.json()) as { clock: ClockView }).clock);
  }, []);

  useLiveRefresh(refresh, '/api/sse/me');

  async function send(command: Command): Promise<void> {
    setError(null);
    const response = await fetch('/api/admin/clock', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(command),
    });
    if (!response.ok) {
      setError(
        response.status === 403
          ? 'The clock can only be changed when the demo mode is on.'
          : 'That change was not accepted.',
      );
      return;
    }
    setClock(((await response.json()) as { clock: ClockView }).clock);
  }

  async function setExact(): Promise<void> {
    const timeMs = Date.parse(`${typed}:00+08:00`);
    if (Number.isNaN(timeMs)) {
      setError('Enter a date and time first.');
      return;
    }
    await send({ kind: 'set', timeMs });
  }

  const locked = !clock.demoMode;

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <Card title="Current demo time">
        <p className="text-2xl font-semibold tabular-nums" data-clock-time>
          {formatHongKong(shownMs)}
        </p>
        <p className="mt-1 text-sm text-navy" data-clock-speed>
          Hong Kong time. Speed: {speedLabel(clock.speed)}. Mode: {clock.mode}.
        </p>
        {locked ? (
          <p className="mt-3 text-sm text-navy" data-clock-locked>
            Demo mode is off, so the clock cannot be changed here.
          </p>
        ) : null}
      </Card>

      <Card title="Change the clock">
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-sm font-medium">Speed</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Clock speed">
              {SPEEDS.map((speed) => (
                <Button
                  key={speed}
                  type="button"
                  tone={clock.speed === speed ? 'primary' : 'quiet'}
                  aria-pressed={clock.speed === speed}
                  data-speed={speed}
                  disabled={locked}
                  onClick={() => void send({ kind: 'speed', speed })}
                >
                  {speedLabel(speed)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Jump forward</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Jump forward">
              {JUMPS.map((jump) => (
                <Button
                  key={jump.minutes}
                  type="button"
                  tone="quiet"
                  data-jump={jump.minutes}
                  disabled={locked}
                  onClick={() => void send({ kind: 'jump', minutes: jump.minutes })}
                >
                  {jump.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Set an exact time (Hong Kong)</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                aria-label="Exact demo time"
                data-set-time
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                className="rounded-md border border-navy/60 px-3 py-2 text-sm"
              />
              <Button type="button" tone="quiet" disabled={locked} onClick={() => void setExact()}>
                Set time
              </Button>
            </div>
          </div>

          <div>
            <Button
              type="button"
              data-start
              disabled={locked}
              onClick={() => void send({ kind: 'start' })}
            >
              Back to demo start, paused
            </Button>
          </div>
          <ErrorNote message={error} />
        </div>
      </Card>
    </div>
  );
}
