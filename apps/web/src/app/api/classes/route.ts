import { freeWindowsFromClasses } from '@app/core';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { badRequest, readJson } from '@/server/http';
import { requireRole } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CLASSES = 70;

const classSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
    buildingId: z.string().uuid(),
  })
  .strict()
  .refine((entry) => entry.endMinute > entry.startMinute, 'endMinute must be after startMinute');

const putSchema = z.object({ classes: z.array(classSchema).max(MAX_CLASSES) }).strict();

const classSelect = {
  id: true,
  weekday: true,
  startMinute: true,
  endMinute: true,
  buildingId: true,
} as const;

export async function GET(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;
  const userId = guard.value.userId;

  const [classes, gaps] = await Promise.all([
    prisma.classEntry.findMany({
      where: { userId },
      orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      select: classSelect,
    }),
    prisma.freeWindow.count({ where: { userId } }),
  ]);
  return Response.json({ classes, gapsWithoutClasses: classes.length === 0 && gaps > 0 });
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

  const buildingIds = [...new Set(parsed.data.classes.map((entry) => entry.buildingId))];
  const known = await prisma.building.count({ where: { id: { in: buildingIds } } });
  if (known !== buildingIds.length) return badRequest('classes: unknown building');

  const userId = guard.value.userId;
  await prisma.$transaction([
    prisma.classEntry.deleteMany({ where: { userId } }),
    prisma.classEntry.createMany({
      data: parsed.data.classes.map((entry) => ({ userId, ...entry })),
    }),
    prisma.freeWindow.deleteMany({ where: { userId } }),
    prisma.freeWindow.createMany({
      data: freeWindowsFromClasses(parsed.data.classes).map((window) => ({ userId, ...window })),
    }),
  ]);

  const classes = await prisma.classEntry.findMany({
    where: { userId },
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
    select: classSelect,
  });
  return Response.json({ classes, gapsWithoutClasses: false });
}
