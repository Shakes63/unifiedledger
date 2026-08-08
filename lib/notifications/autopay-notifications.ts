/**
 * Autopay Notifications
 *
 * The per-payment success/failure notification senders were deleted with the
 * dead pre-v2 autopay engine (they were never called by the live runAutopay
 * path). Only the cron summary formatter is live. If per-payment
 * notifications are wanted, wire them into runAutopay's result handling.
 */

/**
 * Get a summary message for autopay processing results
 * Useful for admin/cron job reporting
 */
export function getAutopayProcessingSummary(result: {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  totalAmount: number;
}): string {
  const parts: string[] = [];
  
  if (result.successful > 0) {
    parts.push(`${result.successful} payment${result.successful !== 1 ? 's' : ''} processed ($${result.totalAmount.toFixed(2)} total)`);
  }
  
  if (result.failed > 0) {
    parts.push(`${result.failed} failed`);
  }
  
  if (result.skipped > 0) {
    parts.push(`${result.skipped} skipped`);
  }
  
  if (parts.length === 0) {
    return 'No autopay bills due today';
  }
  
  return parts.join(', ');
}

