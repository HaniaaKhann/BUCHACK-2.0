import { z } from 'zod';
import { prisma } from '@/server/db';
import { badRequest, readJson } from '@/server/http';
import { requireRole } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_WINDOWS = 70;

const windowSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
    prevBuildingId: z.string().uuid().nullable(),
    nextBuildingId: z.string().uuid().nullable(),
  })
  .strict()
  .refine((window) => window.endMinute > window.startMinute, 'endMinute must be after startMinute');

const putSchema = z.object({ windows: z.array(windowSchema).max(MAX_WINDOWS) }).strict();

const windowSelect = {
  id: true,
  weekday: true,
  startMinute: true,
  endMinute: true,
  prevBuildingId: true,
  nextBuildingId: true,
} as const;

export async function GET(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;

  const windows = await prisma.freeWindow.findMany({
    where: { userId: guard.value.userId },
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
    select: windowSelect,
  });
  return Response.json({ windows });
}

export async function PUT(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = putSchema.safeParse(body.value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return badRequest(`${issue?.path.join('.')}: ${issue?.message}`);
  }

  const buildingIds = [
    ...new Set(
      parsed.data.windows.flatMap((window) => [window.prevBuildingId, window.nextBuildingId]),
    ),
  ].filter((id): id is string => id !== null);
  const known = await prisma.building.count({ where: { id: { in: buildingIds } } });
  if (known !== buildingIds.length) return badRequest('windows: unknown building');

  const userId = guard.value.userId;
  await prisma.$transaction([
    prisma.freeWindow.deleteMany({ where: { userId } }),
    prisma.freeWindow.createMany({
      data: parsed.data.windows.map((window) => ({ userId, ...window })),
    }),
  ]);
  const windows = await prisma.freeWindow.findMany({
    where: { userId },
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
    select: windowSelect,
  });
  return Response.json({ windows });
}
