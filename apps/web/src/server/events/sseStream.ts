import type { ConnectionRegistry } from './connectionRegistry';
import type { EventFilter, EventHub } from './eventHub';
import { toWire, type AppEvent } from './notifications';

export const SSE_RETRY_MS = 3000;
export const SSE_HEARTBEAT_MS = 15_000;

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

export function formatEvent(event: AppEvent): string {
  const { name, data } = toWire(event);
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const OPENING_FRAME = `: connected\nretry: ${SSE_RETRY_MS}\n\n`;
export const HEARTBEAT_FRAME = ': heartbeat\n\n';

export interface EventStreamOptions {
  request: Request;
  userId: string;
  filter: EventFilter;
  hub: EventHub;
  registry: ConnectionRegistry;
  heartbeatMs?: number;
}

export function openEventStream(options: EventStreamOptions): Response {
  const encoder = new TextEncoder();
  let teardown: (closeStream: boolean) => void = () => undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (frame: string): void => {
        if (!closed) controller.enqueue(encoder.encode(frame));
      };
      const onAbort = (): void => teardown(true);

      const unsubscribe = options.hub.subscribe(options.filter, (event) =>
        send(formatEvent(event)),
      );
      const heartbeat = setInterval(
        () => send(HEARTBEAT_FRAME),
        options.heartbeatMs ?? SSE_HEARTBEAT_MS,
      );
      const release = options.registry.open(options.userId, onAbort);

      teardown = (closeStream) => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        release();
        options.request.signal.removeEventListener('abort', onAbort);
        if (closeStream) controller.close();
      };

      options.request.signal.addEventListener('abort', onAbort);
      if (options.request.signal.aborted) {
        onAbort();
        return;
      }
      send(OPENING_FRAME);
    },
    cancel() {
      teardown(false);
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}
