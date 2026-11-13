import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, PrismaClient } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as authPost } from '../src/app/api/auth/[...all]/route';
import { GET as sseMe } from '../src/app/api/sse/me/route';
import { GET as sseVendor } from '../src/app/api/sse/vendor/[id]/route';
import {
  getConnectionRegistry,
  getEventHub,
  stopEventListener,
} from '../src/server/events/runtime';

const BASE_URL = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000';
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const db = new PrismaClient();

type AccountKey = 'student' | 'owner' | 'staff' | 'admin';
const ALL: readonly AccountKey[] = ['student', 'owner', 'staff', 'admin'];
const cookies = new Map<AccountKey, string>();
let studentId = '';
let memberVendorId = '';
let otherVendorId = '';

function emailOf(key: AccountKey): string {
  const email = DEMO_ACCOUNTS.find((a) => a.email.startsWith(`${key}@`))?.email;
  if (!email) throw new Error(`no demo account ${key}`);
  return email;
}

async function signIn(email: string): Promise<Response> {
  return authPost(
    new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE_URL },
      body: JSON.stringify({ email, password: DEMO_PASSWORD }),
    }),
  );
}

function request(path: string, key: AccountKey | null, signal?: AbortSignal): Request {
  const headers = new Headers({ origin: BASE_URL });
  const cookie = key ? cookies.get(key) : undefined;
  if (cookie) headers.set('cookie', cookie);
  return new Request(`${BASE_URL}${path}`, { headers, ...(signal ? { signal } : {}) });
}

const vendorContext = (id: string): { params: Promise<{ id: string }> } => ({
  params: Promise.resolve({ id }),
});

interface Frame {
  name: string | null;
  data: string | null;
  raw: string;
}

class StreamReader {
  readonly frames: Frame[] = [];
  private waiters: (() => void)[] = [];

  constructor(response: Response) {
    void this.pump(response.body?.getReader());
  }

  private async pump(reader: ReadableStreamDefaultReader<Uint8Array> | undefined): Promise<void> {
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const chunk = await reader.read().catch(() => ({ done: true as const, value: undefined }));
      if (chunk.done) return;
      buffer += decoder.decode(chunk.value, { stream: true });
      let end = buffer.indexOf('\n\n');
      while (end >= 0) {
        this.frames.push(parseFrame(buffer.slice(0, end)));
        buffer = buffer.slice(end + 2);
        end = buffer.indexOf('\n\n');
      }
      for (const wake of this.waiters.splice(0)) wake();
    }
  }

  async waitFor(match: (frame: Frame) => boolean, timeoutMs: number): Promise<Frame | null> {
    const deadline = performance.now() + timeoutMs;
    for (;;) {
      const found = this.frames.find(match);
      if (found) return found;
      const remaining = deadline - performance.now();
      if (remaining <= 0) return null;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, remaining);
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }
}

function parseFrame(raw: string): Frame {
  const lines = raw.split('\n');
  const field = (prefix: string): string | null =>
    lines.find((line) => line.startsWith(prefix))?.slice(prefix.length) ?? null;
  return { name: field('event: '), data: field('data: '), raw };
}

const isOrder =
  (orderId: string) =>
  (frame: Frame): boolean =>
    frame.name === 'order' && (frame.data ?? '').includes(`"orderId":"${orderId}"`);

async function notifyOrder(
  orderId: string,
  vendorId: string,
  forStudent: string,
  status = 'accepted',
): Promise<void> {
  const payload = JSON.stringify({ orderId, vendorId, studentId: forStudent, status });
  await db.$executeRaw`SELECT pg_notify('order_changed', ${payload})`;
}

async function waitUntilListening(
  reader: StreamReader,
  vendorId: string,
  forStudent: string,
): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const orderId = `warmup-${Date.now()}-${attempt}`;
    await notifyOrder(orderId, vendorId, forStudent);
    if (await reader.waitFor(isOrder(orderId), 250)) return;
  }
  throw new Error('listener never became ready');
}

beforeAll(async () => {
  const env = { ...process.env, DEMO_MODE: 'true' };
  execSync('pnpm --filter @app/db migrate:deploy', { cwd: repoRoot, env, stdio: 'pipe' });
  execSync('pnpm --filter @app/db seed', { cwd: repoRoot, env, stdio: 'pipe' });

  for (const key of ALL) {
    const response = await signIn(emailOf(key));
    expect(response.status, `sign-in ${key}`).toBe(200);
    cookies.set(
      key,
      response.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    );
  }

  studentId = (await db.user.findUniqueOrThrow({ where: { email: emailOf('student') } })).id;
  const owner = await db.user.findUniqueOrThrow({ where: { email: emailOf('owner') } });
  memberVendorId = (await db.vendorMember.findFirstOrThrow({ where: { userId: owner.id } }))
    .vendorId;
  otherVendorId = (await db.vendor.findFirstOrThrow({ where: { id: { not: memberVendorId } } })).id;
}, 180_000);

afterAll(async () => {
  await stopEventListener();
  await db.session.deleteMany({
    where: { user: { email: { in: DEMO_ACCOUNTS.map((a) => a.email) } } },
  });
  await db.$disconnect();
});

async function statusOf(response: Response): Promise<number> {
  await response.body?.cancel();
  return response.status;
}

describe('GET /api/sse/me role gate', () => {
  it('lets only a student open the stream, with streaming headers', async () => {
    for (const key of ALL) {
      const response = await sseMe(request('/api/sse/me', key));
      if (key === 'student') {
        expect(response.headers.get('content-type')).toBe('text/event-stream');
        expect(response.headers.get('cache-control')).toBe('no-cache, no-transform');
        expect(response.headers.get('x-accel-buffering')).toBe('no');
      }
      expect(await statusOf(response), key).toBe(key === 'student' ? 200 : 403);
    }
    expect(await statusOf(await sseMe(request('/api/sse/me', null)))).toBe(401);
  });
});

describe('GET /api/sse/vendor/:id role gate', () => {
  it('lets only members of that vendor open the stream', async () => {
    for (const key of ALL) {
      const response = await sseVendor(
        request(`/api/sse/vendor/${memberVendorId}`, key),
        vendorContext(memberVendorId),
      );
      const member = key === 'owner' || key === 'staff';
      expect(await statusOf(response), key).toBe(member ? 200 : 403);
    }
    const anonymous = await sseVendor(
      request(`/api/sse/vendor/${memberVendorId}`, null),
      vendorContext(memberVendorId),
    );
    expect(await statusOf(anonymous)).toBe(401);
  });

  it('denies members a vendor they do not belong to and rejects bad ids', async () => {
    for (const key of ['owner', 'staff'] as const) {
      const response = await sseVendor(
        request(`/api/sse/vendor/${otherVendorId}`, key),
        vendorContext(otherVendorId),
      );
      expect(await statusOf(response), key).toBe(403);
    }
    const bad = await sseVendor(
      request('/api/sse/vendor/not-a-uuid', 'owner'),
      vendorContext('not-a-uuid'),
    );
    expect(await statusOf(bad)).toBe(400);
  });
});

describe('real notifications reach open streams', () => {
  it('delivers a student order event in under a second and only to that student', async () => {
    const abort = new AbortController();
    const response = await sseMe(request('/api/sse/me', 'student', abort.signal));
    const reader = new StreamReader(response);
    expect(await reader.waitFor((f) => f.raw.includes('retry: 3000'), 2000)).not.toBeNull();
    await waitUntilListening(reader, memberVendorId, studentId);

    await notifyOrder('someone-elses-order', memberVendorId, 'another-student');
    const startedAt = performance.now();
    await notifyOrder('my-order', memberVendorId, studentId, 'ready');
    const frame = await reader.waitFor(isOrder('my-order'), 3000);
    const elapsedMs = performance.now() - startedAt;

    expect(frame).not.toBeNull();
    expect(JSON.parse(frame?.data ?? '{}')).toMatchObject({
      orderId: 'my-order',
      vendorId: memberVendorId,
      status: 'ready',
    });
    expect(frame?.data).not.toContain(studentId);
    expect(elapsedMs).toBeLessThan(1000);
    expect(reader.frames.some(isOrder('someone-elses-order'))).toBe(false);

    const snapshot = JSON.stringify({
      vendorId: otherVendorId,
      computedAt: '2026-11-17T04:15:00Z',
    });
    await db.$executeRaw`SELECT pg_notify('snapshot_written', ${snapshot})`;
    expect(await reader.waitFor((f) => f.name === 'snapshot', 2000)).not.toBeNull();
    abort.abort();
  });

  it('delivers only its own vendor events to a vendor stream', async () => {
    const abort = new AbortController();
    const response = await sseVendor(
      request(`/api/sse/vendor/${memberVendorId}`, 'owner', abort.signal),
      vendorContext(memberVendorId),
    );
    const reader = new StreamReader(response);
    await waitUntilListening(reader, memberVendorId, studentId);

    await notifyOrder('other-vendor-order', otherVendorId, studentId);
    await notifyOrder('own-vendor-order', memberVendorId, studentId);
    expect(await reader.waitFor(isOrder('own-vendor-order'), 3000)).not.toBeNull();
    expect(reader.frames.some(isOrder('other-vendor-order'))).toBe(false);

    const snapshot = JSON.stringify({
      vendorId: memberVendorId,
      computedAt: '2026-11-17T04:30:00Z',
    });
    await db.$executeRaw`SELECT pg_notify('snapshot_written', ${snapshot})`;
    expect(await reader.waitFor((f) => f.name === 'snapshot', 2000)).not.toBeNull();
    abort.abort();
  });

  it('leaves no connections or subscribers behind once clients disconnect', async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getConnectionRegistry().total()).toBe(0);
    expect(getEventHub().subscriberCount()).toBe(0);
  });
});
