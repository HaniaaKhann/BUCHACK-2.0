import { GOAL_OPTIONS, isAllergenId, isDietId } from '@app/core';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { badRequest, readJson } from '@/server/http';
import { requireRole } from '@/server/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const profileSelect = {
  dietTags: true,
  allergens: true,
  goal: true,
  eatMinutes: true,
  chatLanguage: true,
  currentBuildingId: true,
} as const;

const patchSchema = z
  .object({
    dietTags: z.array(z.string().refine(isDietId, 'unknown diet option')).max(10),
    allergens: z.array(z.string().refine(isAllergenId, 'unknown allergen option')).max(12),
    goal: z.enum(GOAL_OPTIONS).nullable(),
    eatMinutes: z.number().int().min(0).max(60),
    chatLanguage: z.enum(['en', 'zh_HK', 'zh_CN']),
    currentBuildingId: z.string().uuid().nullable(),
  })
  .partial()
  .strict();

export async function GET(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;

  const [user, profile] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: guard.value.userId },
      select: { id: true, email: true, name: true },
    }),
    prisma.studentProfile.findUnique({
      where: { userId: guard.value.userId },
      select: profileSelect,
    }),
  ]);
  return Response.json({ user, onboardingComplete: profile !== null, profile });
}

export async function PATCH(request: Request): Promise<Response> {
  const guard = await requireRole(request, ['student']);
  if (!guard.ok) return guard.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = patchSchema.safeParse(body.value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return badRequest(`${issue?.path.join('.')}: ${issue?.message}`);
  }

  const { currentBuildingId } = parsed.data;
  if (typeof currentBuildingId === 'string') {
    const exists = await prisma.building.findUnique({
      where: { id: currentBuildingId },
      select: { id: true },
    });
    if (exists === null) return badRequest('currentBuildingId: unknown building');
  }

  const changes = {
    ...(parsed.data.dietTags ? { dietTags: [...new Set(parsed.data.dietTags)] } : {}),
    ...(parsed.data.allergens ? { allergens: [...new Set(parsed.data.allergens)] } : {}),
    ...(parsed.data.goal !== undefined ? { goal: parsed.data.goal } : {}),
    ...(parsed.data.eatMinutes !== undefined ? { eatMinutes: parsed.data.eatMinutes } : {}),
    ...(parsed.data.chatLanguage ? { chatLanguage: parsed.data.chatLanguage } : {}),
    ...(currentBuildingId !== undefined ? { currentBuildingId } : {}),
  };
  const profile = await prisma.studentProfile.upsert({
    where: { userId: guard.value.userId },
    create: {
      userId: guard.value.userId,
      dietTags: [],
      allergens: [],
      eatMinutes: 15,
      chatLanguage: 'en',
      ...changes,
    },
    update: changes,
    select: profileSelect,
  });
  return Response.json({ onboardingComplete: true, profile });
}
