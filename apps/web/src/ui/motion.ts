export const STAGGER_STEP_MS = 40;
export const STAGGER_LENGTH = 12;

export function staggerDelay(index: number): string {
  return `${(index % STAGGER_LENGTH) * STAGGER_STEP_MS}ms`;
}
