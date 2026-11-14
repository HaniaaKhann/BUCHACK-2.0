import { OrderError } from './orderErrors';

export function orderErrorResponse(error: unknown): Response {
  if (error instanceof OrderError) {
    return Response.json({ error: error.code, ...error.extra }, { status: error.status });
  }
  throw error;
}
