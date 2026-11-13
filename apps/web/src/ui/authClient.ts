export type AuthResult = { ok: true } | { ok: false; message: string };

export async function postAuth(path: string, body: unknown): Promise<AuthResult> {
  const response = await fetch(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.ok) return { ok: true };
  const data = (await response.json().catch(() => null)) as { message?: string } | null;
  return { ok: false, message: data?.message ?? 'Something went wrong. Please try again.' };
}
