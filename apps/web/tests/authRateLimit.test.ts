import { describe, expect, it } from 'vitest';
import { DEMO_SIGN_IN_RULE, rateLimitOptions } from '../src/server/authRateLimit';

describe('rateLimitOptions', () => {
  it('keeps the Better Auth defaults when DEMO_MODE is not true', () => {
    expect(rateLimitOptions(undefined)).toEqual({});
    expect(rateLimitOptions('false')).toEqual({});
    expect(rateLimitOptions('')).toEqual({});
  });

  it('relaxes only the sign-in rule when DEMO_MODE is true', () => {
    const rules = rateLimitOptions('true').rateLimit?.customRules ?? {};
    expect(Object.keys(rules)).toEqual(['/sign-in/email']);
    expect(rules['/sign-in/email']).toEqual(DEMO_SIGN_IN_RULE);
    expect(DEMO_SIGN_IN_RULE.max).toBeGreaterThanOrEqual(100);
  });
});
