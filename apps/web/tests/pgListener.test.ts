import { describe, expect, it, vi } from 'vitest';
import { createEventHub } from '../src/server/events/eventHub';
import type { AppEvent } from '../src/server/events/notifications';
import {
  backoffMs,
  createPgListener,
  type ListenClient,
  type PgListener,
} from '../src/server/events/pgListener';

class FakeClient implements ListenClient {
  queries: string[] = [];
  ended = false;
  failConnect = false;
  private notification: Parameters<ListenClient['onNotification']>[0] = () => undefined;
  private error: (error: Error) => void = () => undefined;
  private end_: () => void = () => undefined;

  connect(): Promise<void> {
    return this.failConnect ? Promise.reject(new Error('refused')) : Promise.resolve();
  }
  query(text: string): Promise<unknown> {
    this.queries.push(text);
    return Promise.resolve();
  }
  end(): Promise<void> {
    this.ended = true;
    return Promise.resolve();
  }
  onNotification(handler: Parameters<ListenClient['onNotification']>[0]): void {
    this.notification = handler;
  }
  onError(handler: (error: Error) => void): void {
    this.error = handler;
  }
  onEnd(handler: () => void): void {
    this.end_ = handler;
  }
  emitNotification(channel: string, payload?: string): void {
    this.notification({ channel, payload });
  }
  emitError(): void {
    this.error(new Error('lost'));
  }
  emitEnd(): void {
    this.end_();
  }
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function setup(): {
  listener: PgListener;
  clients: FakeClient[];
  events: AppEvent[];
  retries: { delay: number; run: () => void; cancelled: boolean }[];
  failNext: { count: number };
} {
  const clients: FakeClient[] = [];
  const events: AppEvent[] = [];
  const retries: { delay: number; run: () => void; cancelled: boolean }[] = [];
  const failNext = { count: 0 };
  const hub = createEventHub();
  hub.subscribe(
    () => true,
    (event) => events.push(event),
  );
  const listener = createPgListener({
    createClient: () => {
      const client = new FakeClient();
      if (failNext.count > 0) {
        failNext.count -= 1;
        client.failConnect = true;
      }
      clients.push(client);
      return client;
    },
    hub,
    schedule: (run, delay) => {
      const retry = { delay, run, cancelled: false };
      retries.push(retry);
      return () => {
        retry.cancelled = true;
      };
    },
    now: () => 42,
    log: vi.fn(),
  });
  return { listener, clients, events, retries, failNext };
}

describe('backoffMs', () => {
  it('doubles from 500 ms up to a 15 s cap', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 10].map(backoffMs)).toEqual([
      500, 1000, 2000, 4000, 8000, 15_000, 15_000, 15_000,
    ]);
  });
});

describe('createPgListener', () => {
  it('listens on both channels and turns notifications into hub events', async () => {
    const { listener, clients, events } = setup();
    listener.start();
    await settle();
    expect(clients[0]?.queries).toEqual([
      'LISTEN order_changed',
      'LISTEN snapshot_written',
      'LISTEN vendor_changed',
    ]);
    clients[0]?.emitNotification(
      'order_changed',
      JSON.stringify({ orderId: 'o', vendorId: 'v', studentId: 's', status: 'ready' }),
    );
    clients[0]?.emitNotification('order_changed', 'garbage');
    expect(events).toEqual([
      { kind: 'order', orderId: 'o', vendorId: 'v', studentId: 's', status: 'ready', at: 42 },
      { kind: 'queue', vendorId: 'v' },
    ]);
  });

  it('opens only one connection however often it is started', async () => {
    const { listener, clients } = setup();
    listener.start();
    listener.start();
    await settle();
    expect(clients).toHaveLength(1);
  });

  it('reconnects after the connection ends and sends one resync once listening again', async () => {
    const { listener, clients, events, retries } = setup();
    listener.start();
    await settle();
    expect(events).toEqual([]);

    clients[0]?.emitEnd();
    clients[0]?.emitError();
    expect(retries).toHaveLength(1);
    expect(retries[0]?.delay).toBe(500);
    expect(clients[0]?.ended).toBe(true);

    retries[0]?.run();
    await settle();
    expect(clients).toHaveLength(2);
    expect(clients[1]?.queries).toHaveLength(3);
    expect(events).toEqual([{ kind: 'resync' }]);
  });

  it('backs off while connecting keeps failing and resets after success', async () => {
    const { listener, clients, retries, failNext } = setup();
    listener.start();
    await settle();
    clients[0]?.emitError();

    failNext.count = 1;
    retries[0]?.run();
    await settle();
    expect(retries.map((retry) => retry.delay)).toEqual([500, 1000]);

    retries[1]?.run();
    await settle();
    clients[2]?.emitError();
    expect(retries.map((retry) => retry.delay)).toEqual([500, 1000, 500]);
  });

  it('stops retrying after stop and closes the live connection', async () => {
    const { listener, clients, retries } = setup();
    listener.start();
    await settle();
    clients[0]?.emitError();
    await listener.stop();
    expect(retries[0]?.cancelled).toBe(true);
    retries[0]?.run();
    expect(clients).toHaveLength(1);

    const second = setup();
    second.listener.start();
    await settle();
    await second.listener.stop();
    expect(second.clients[0]?.ended).toBe(true);
    second.clients[0]?.emitError();
    expect(second.retries).toHaveLength(0);
  });
});
