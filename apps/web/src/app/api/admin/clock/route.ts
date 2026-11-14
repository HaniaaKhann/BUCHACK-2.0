import { DEMO_CLOCK_START } from '@app/db';
import { z } from 'zod';
import { applyClockCommand, getClockView } from '@/server/clockAdmin';
import { isDemoMode } from '@/server/demoMode';
import { requireRole } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_TIME_MS = Date.UTC(2020, 0, 1);
const MAX_TIME_MS = Date.UTC(2100, 0, 1);

const bodySchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('speed'),
      speed: z.union([z.literal(0), z.literal(1), z.literal(10), z.literal(60)]),
    })
    .strict(),
  z
    .object({
      kind: z.literal('jump'),
      minutes: z.union([z.literal(15), z.literal(60), z.literal(1440)]),
    })
    .strict(),
  z
    .object({ kind: z.literal('set'), timeMs: z.number().int().min(MIN_TIME_MS).max(MAX_TIME_MS) })
    .strict(),
  z.object({ kind: z.literal('start') }).strict(),
]);

export async function GET(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['admin']);
  if (!guard.ok) return guard.response;
  return Response.json({ clock: await getClockView() });
}

export async function PATCH(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['admin']);
  if (!guard.ok) return guard.response;
  if (!isDemoMode()) return Response.json({ error: 'demo_mode_off' }, { status: 403 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'invalid_request' }, { status: 400 });

  const command =
    body.data.kind === 'start'
      ? { kind: 'start' as const, startMs: Date.parse(DEMO_CLOCK_START) }
      : body.data;
  return Response.json({ clock: await applyClockCommand(command) });
}
