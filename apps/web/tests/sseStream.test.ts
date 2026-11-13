import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConnectionRegistry } from '../src/server/events/connectionRegistry';
import { createEventHub, studentFilter } from '../src/server/events/eventHub';
import type { AppEvent } from '../src/server/events/notifications';
import {
  HEARTBEAT_FRAME,
  OPENING_FRAME,
  SSE_HEADERS,
  formatEvent,
  openEventStream,
} from '../src/server/events/sseStream';

const order = (studentId: string, orderId = 'order-1'): AppEvent => ({
  kind: 'order',
  orderId,
  vendorId: 'vendor-1',
  studentId,
  status: 'ready',
  at: 7,
});

function open(
  options: {
    userId?: string;
    controller?: AbortController;
    hub?: ReturnType<typeof createEventHub>;
    registry?: ReturnType<typeof createConnectionRegistry>;
    heartbeatMs?: number;
  } = {},
) {
  const controller = options.controller ?? new AbortController();
  const hub = options.hub ?? createEventHub();
  const registry = options.registry ?? createConnectionRegistry(5);
  const userId = options.userId ?? 'student-1';
  const response = openEventStream({
    request: new Request('http://localhost/api/sse/me', { signal: controller.signal }),
    userId,
    filter: studentFilter(userId),
    hub,
    registry,
    ...(options.heartbeatMs === undefined ? {} : { heartbeatMs: options.heartbeatMs }),
  });
  const reader = response.body?.getReader();
  if (!reader) throw new Error('no body');
  const decoder = new TextDecoder();
  const read = async (): Promise<string> => {
    const chunk = await reader.read();
    return chunk.done ? '<closed>' : decoder.decode(chunk.value);
  };
  return { response, reader, read, controller, hub, registry };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SSE response', () => {
  it('sets the streaming headers', () => {
    const { response, controller } = open();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-cache, no-transform');
    expect(response.headers.get('connection')).toBe('keep-alive');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(Object.keys(SSE_HEADERS)).toHaveLength(4);
    controller.abort();
  });

  it('flushes a comment line and the retry hint immediately', async () => {
    const { read, controller } = open();
    const first = await read();
    expect(first).toBe(OPENING_FRAME);
    expect(first).toContain(': connected');
    expect(first).toContain('retry: 3000');
    controller.abort();
  });
});

describe('formatEvent', () => {
  it('writes an event name, one JSON data line and a blank line', () => {
    expect(formatEvent(order('student-1'))).toBe(
      'event: order\ndata: {"orderId":"order-1","vendorId":"vendor-1","status":"ready","at":7}\n\n',
    );
  });
});

describe('event delivery', () => {
  it('streams events for this student and not for another student', async () => {
    const { read, hub, controller } = open();
    await read();
    hub.publish(order('student-2', 'someone-else'));
    hub.publish(order('student-1', 'mine'));
    const frame = await read();
    expect(frame).toContain('"orderId":"mine"');
    expect(frame).not.toContain('someone-else');
    controller.abort();
  });

  it('sends a heartbeat comment on the interval', async () => {
    vi.useFakeTimers();
    const { read, controller } = open({ heartbeatMs: 1000 });
    await read();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await read()).toBe(HEARTBEAT_FRAME);
    controller.abort();
  });
});

describe('cleanup', () => {
  it('returns the registry and hub subscriber counts to zero after a client abort', async () => {
    const hub = createEventHub();
    const registry = createConnectionRegistry(5);
    const a = open({ hub, registry, userId: 'student-1' });
    const b = open({ hub, registry, userId: 'student-2' });
    await a.read();
    await b.read();
    expect(registry.total()).toBe(2);
    expect(hub.subscriberCount()).toBe(2);

    a.controller.abort();
    expect(await a.read()).toBe('<closed>');
    expect(registry.total()).toBe(1);
    expect(hub.subscriberCount()).toBe(1);

    b.controller.abort();
    expect(await b.read()).toBe('<closed>');
    expect(registry.total()).toBe(0);
    expect(registry.count('student-1')).toBe(0);
    expect(hub.subscriberCount()).toBe(0);
  });

  it('returns the counts to zero when the reader cancels the body', async () => {
    const { reader, hub, registry, read } = open();
    await read();
    await reader.cancel();
    expect(registry.total()).toBe(0);
    expect(hub.subscriberCount()).toBe(0);
  });

  it('opens nothing when the request is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { read, hub, registry } = open({ controller });
    expect(await read()).toBe('<closed>');
    expect(registry.total()).toBe(0);
    expect(hub.subscriberCount()).toBe(0);
  });

  it('stops the heartbeat after the stream closes', async () => {
    vi.useFakeTimers();
    const { read, controller } = open({ heartbeatMs: 1000 });
    await read();
    controller.abort();
    expect(await read()).toBe('<closed>');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('connection cap', () => {
  it('closes the oldest stream when a user opens more than the limit', async () => {
    const hub = createEventHub();
    const registry = createConnectionRegistry(2);
    const first = open({ hub, registry });
    const second = open({ hub, registry });
    await first.read();
    await second.read();

    const third = open({ hub, registry });
    expect(await first.read()).toBe('<closed>');
    expect(registry.count('student-1')).toBe(2);
    expect(hub.subscriberCount()).toBe(2);

    second.controller.abort();
    third.controller.abort();
    expect(registry.total()).toBe(0);
    expect(hub.subscriberCount()).toBe(0);
  });

  it('does not count one user against another', () => {
    const registry = createConnectionRegistry(1);
    const closed = vi.fn();
    registry.open('a', closed);
    registry.open('b', closed);
    expect(closed).not.toHaveBeenCalled();
    expect(registry.total()).toBe(2);
  });
});
