import { createConnectionRegistry, type ConnectionRegistry } from './connectionRegistry';
import { createEventHub, type EventHub } from './eventHub';
import { createPgClient, createPgListener, type PgListener } from './pgListener';

const MAX_STREAMS_PER_USER = 5;

interface EventRuntime {
  hub: EventHub;
  registry: ConnectionRegistry;
  listener: PgListener | null;
}

const globalForEvents = globalThis as unknown as { appEvents?: EventRuntime };

function runtimeState(): EventRuntime {
  globalForEvents.appEvents ??= {
    hub: createEventHub(),
    registry: createConnectionRegistry(MAX_STREAMS_PER_USER),
    listener: null,
  };
  return globalForEvents.appEvents;
}

export function getEventHub(): EventHub {
  return runtimeState().hub;
}

export function getConnectionRegistry(): ConnectionRegistry {
  return runtimeState().registry;
}

export function ensureEventListener(): void {
  const state = runtimeState();
  if (state.listener !== null) return;
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  state.listener = createPgListener({
    createClient: () => createPgClient(connectionString),
    hub: state.hub,
    schedule: (run, delayMs) => {
      const timer = setTimeout(run, delayMs);
      return () => clearTimeout(timer);
    },
    now: Date.now,
    log: (line) => process.stderr.write(`[events] ${line}\n`),
  });
  state.listener.start();
}

export async function stopEventListener(): Promise<void> {
  const state = runtimeState();
  await state.listener?.stop();
  state.listener = null;
}
