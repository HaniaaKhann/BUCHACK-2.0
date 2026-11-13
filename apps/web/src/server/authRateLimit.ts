export interface RateLimitRule {
  window: number;
  max: number;
}

export interface RateLimitOptions {
  rateLimit?: { customRules: Record<string, RateLimitRule> };
}

export const DEMO_SIGN_IN_RULE: RateLimitRule = { window: 10, max: 100 };

export function rateLimitOptions(demoMode: string | undefined): RateLimitOptions {
  if (demoMode !== 'true') return {};
  return { rateLimit: { customRules: { '/sign-in/email': { ...DEMO_SIGN_IN_RULE } } } };
}
