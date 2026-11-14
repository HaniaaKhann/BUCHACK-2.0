export async function readJson(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false, response: Response.json({ error: 'invalid json' }, { status: 400 }) };
  }
}

export function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}
