import { afterEach, describe, expect, it } from 'vitest';
import { isTestMode } from '@/lib/test-mode';

describe('TEST_MODE production hard-block — M-SEC-10', () => {
  const originalTestMode = process.env.TEST_MODE;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalTestMode === undefined) delete process.env.TEST_MODE;
    else process.env.TEST_MODE = originalTestMode;
    // NODE_ENV is read-only-ish under some setups; assign defensively.
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  });

  it('throws when TEST_MODE=true and NODE_ENV=production', () => {
    process.env.TEST_MODE = 'true';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    expect(() => isTestMode()).toThrow(/not permitted when NODE_ENV=production/);
  });

  it('returns true when TEST_MODE=true outside production', () => {
    process.env.TEST_MODE = 'true';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    expect(isTestMode()).toBe(true);
  });

  it('returns false when TEST_MODE is unset in production (no throw)', () => {
    delete process.env.TEST_MODE;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    expect(isTestMode()).toBe(false);
  });
});
