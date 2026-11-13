import pg from 'pg';
import type { EventHub } from './eventHub';
import { LISTEN_CHANNELS, parseNotification } from './notifications';

const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 15_000;

export function backoffMs(attempt: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);
}

export interface ListenClient {
  connect(): Promise<void>;
  query(text: string): Promise<unknown>;
  end(): Promise<void>;
  onNotification(
    handler: (message: { channel: string; payload?: string | undefined }) => void,
  ): void;
  onError(handler: (error: Error) => void): void;
  onEnd(handler: () => void): void;
}

export interface ListenerDeps {
  createClient: () => ListenClient;
  hub: EventHub;
  schedule: (run: () => void, delayMs: number) => () => void;
  now: () => number;
  log: (line: string) => void;
}

export interface PgListener {
  start(): void;
  stop(): Promise<void>;
}

export function createPgClient(connectionString: string): ListenClient {
  const client = new pg.Client({ connectionString });
  return {
    connect: () => client.connect(),
    query: (text) => client.query(text),
    end: () => client.end(),
    onNotification: (handler) => {
      client.on('notification', handler);
    },
    onError: (handler) => {
      client.on('error', handler);
    },
    onEnd: (handler) => {
      client.on('end', handler);
    },
  };
}

export function createPgListener(deps: ListenerDeps): PgListener {
  let started = false;
  let stopped = false;
  let current: ListenClient | null = null;
  let attempt = 0;
  let hasListened = false;
  let cancelRetry: (() => void) | null = null;

  const drop = (client: ListenClient, reason: string): void => {
    if (stopped || client !== current) return;
    current = null;
    client.end().catch(() => undefined);
    deps.log(`listener dropped (${reason}), retrying in ${backoffMs(attempt)} ms`);
    cancelRetry = deps.schedule(connect, backoffMs(attempt));
    attempt += 1;
  };

  function connect(): void {
    cancelRetry = null;
    if (stopped) return;
    const client = deps.createClient();
    current = client;
    client.onNotification((message) => {
      const event = parseNotification(message.channel, message.payload, deps.now());
      if (event !== null) deps.hub.publish(event);
    });
    client.onError((error) => drop(client, error.message));
    client.onEnd(() => drop(client, 'connection ended'));
    client
      .connect()
      .then(async () => {
        for (const channel of LISTEN_CHANNELS) await client.query(`LISTEN ${channel}`);
        if (client !== current) return;
        attempt = 0;
        if (hasListened) deps.hub.publish({ kind: 'resync' });
        hasListened = true;
      })
      .catch((error: unknown) => drop(client, String(error)));
  }

  return {
    start() {
      if (started) return;
      started = true;
      connect();
    },
    async stop() {
      stopped = true;
      cancelRetry?.();
      const client = current;
      current = null;
      await client?.end().catch(() => undefined);
    },
  };
}
