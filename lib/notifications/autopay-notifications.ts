/**
 * Autopay Notifications
 * 
 * Handles notifications for autopay processing results:
 * - Success notifications (low priority)
 * - Failure notifications (high priority)
 */

import { createNotification } from '@/lib/notifications/notification-service';
import { AutopayResult, FullBillData, FullInstanceData } from '@/lib/bills/autopay-transaction';

const ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_FUNDS: 'Insufficient funds in payment account',
  ACCOUNT_NOT_FOUND: 'Payment account not found or inactive',
  BILL_NOT_FOUND: 'Bill configuration error',
  INSTANCE_NOT_FOUND: 'Bill instance not found',
  ALREADY_PAID: 'Bill was already paid',
  INVALID_CONFIGURATION: 'Autopay configuration is invalid',
  ZERO_AMOUNT: 'No amount to pay',
  SYSTEM_ERROR: 'System error during processing',
};

/**
 * Send a notification when autopay successfully processes a payment
 */
export async function sendAutopaySuccessNotification(
  bill: FullBillData,
  instance: FullInstanceData,
  result: AutopayResult
): Promise<string | null> {
  try {
    // Don't notify for zero-amount "payments"
    if (result.amount <= 0) {
      return null;
    }

    const notificationId = await createNotification({
      userId: bill.userId,
      type: 'bill_due', // Using existing type, message makes it clear it's autopay
      title: `Autopay processed: ${bill.name}`,
      message: `Payment of $${result.amount.toFixed(2)} was automatically processed for ${bill.name}.`,
      priority: 'low',
      actionUrl: '/dashboard/bills',
      actionLabel: 'View Bills',
      isActionable: true,
      entityType: 'billInstance',
      entityId: instance.id,
      metadata: {
        billId: bill.id,
        instanceId: instance.id,
        amount: result.amount,
        amountSource: result.amountSource,
        transactionId: result.transactionId,
        transferId: result.transferId,
        paymentId: result.paymentId,
        paymentMethod: 'autopay',
        isAutopayNotification: true,
        notificationType: 'autopay_processed',
      },
      householdId: bill.householdId,
    });

    return notificationId;
  } catch (error) {
    console.error('Error sending autopay success notification:', error);
    return null;
  }
}

/**
 * Send a notification when autopay fails to process a payment
 */
export async function sendAutopayFailureNotification(
  bill: FullBillData,
  instance: FullInstanceData,
  result: AutopayResult
): Promise<string | null> {
  try {
    const errorMessage = result.errorCode 
      ? ERROR_MESSAGES[result.errorCode] || result.error 
      : result.error;

    // Build a helpful message
    let message = `Automatic payment for ${bill.name} failed.`;
    if (errorMessage) {
      message += ` ${errorMessage}.`;
    }
    
    // Add amount info if available
    if (result.amount > 0) {
      message += ` Amount: $${result.amount.toFixed(2)}.`;
    }
    
    message += ' Please pay manually.';

    const notificationId = await createNotification({
      userId: bill.userId,
      type: 'bill_due', // Using existing type for compatibility
      title: `Autopay failed: ${bill.name}`,
      message,
      priority: 'high',
      actionUrl: '/dashboard/bills',
      actionLabel: 'Pay Now',
      isActionable: true,
      entityType: 'billInstance',
      entityId: instance.id,
      metadata: {
        billId: bill.id,
        instanceId: instance.id,
        amount: result.amount,
        amountSource: result.amountSource,
        errorCode: result.errorCode,
        error: result.error,
        paymentMethod: 'autopay',
        isAutopayNotification: true,
        notificationType: 'autopay_failed',
        dueDate: instance.dueDate,
      },
      householdId: bill.householdId,
    });

    return notificationId;
  } catch (error) {
    console.error('Error sending autopay failure notification:', error);
    return null;
  }
}

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

