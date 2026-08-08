import { describe, it, expect } from 'vitest';
import { getAutopayProcessingSummary } from '@/lib/notifications/autopay-notifications';

/**
 * Only the cron summary formatter survives — the per-payment success/failure
 * senders were deleted with the dead pre-v2 autopay engine (they were never
 * called by the live runAutopay path).
 */
describe('lib/notifications/autopay-notifications', () => {
  describe('getAutopayProcessingSummary', () => {
    it('returns "No autopay bills due today" when nothing happened', () => {
      expect(
        getAutopayProcessingSummary({
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          totalAmount: 0,
        })
      ).toBe('No autopay bills due today');
    });

    it('formats counts and total amount', () => {
      expect(
        getAutopayProcessingSummary({
          processed: 3,
          successful: 2,
          failed: 1,
          skipped: 4,
          totalAmount: 12.5,
        })
      ).toBe('2 payments processed ($12.50 total), 1 failed, 4 skipped');
    });
  });
});
