/**
 * Autopay Transaction Creator
 * 
 * Creates transactions for autopay-enabled bills:
 * - Transfers for credit card payments (from paying account to credit account)
 * - Expenses for regular bills and loan payments
 * - Records payment history in the bill_payments table
 */

import { nanoid } from 'nanoid';
import Decimal from 'decimal.js';
import { db } from '@/lib/db';
import { transactions, accounts, bills, billInstances } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { processBillPayment } from '@/lib/bills/bill-payment-utils';
import { 
  calculateAutopayAmount, 
  validateAutopayConfiguration,
  BillForAutopay,
  BillInstanceForAutopay,
  LinkedAccountData,
  PayingAccountData,
} from '@/lib/bills/autopay-calculator';

export type AutopayErrorCode = 
  | 'INSUFFICIENT_FUNDS' 
  | 'ACCOUNT_NOT_FOUND' 
  | 'BILL_NOT_FOUND' 
  | 'INSTANCE_NOT_FOUND'
  | 'ALREADY_PAID' 
  | 'INVALID_CONFIGURATION'
  | 'ZERO_AMOUNT'
  | 'SYSTEM_ERROR';

export interface AutopayResult {
  success: boolean;
  transactionId?: string;
  transferId?: string;
  amount: number;
  paymentId?: string;
  amountSource?: string;
  error?: string;
  errorCode?: AutopayErrorCode;
}

export interface FullBillData {
  id: string;
  name: string;
  userId: string;
  householdId: string;
  expectedAmount: number;
  categoryId: string | null;
  merchantId: string | null;
  isAutopayEnabled: boolean | null;
  autopayAccountId: string | null;
  autopayAmountType: 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance' | null;
  autopayFixedAmount: number | null;
  autopayDaysBefore: number | null;
  linkedAccountId: string | null;
  isDebt: boolean | null;
}

export interface FullInstanceData {
  id: string;
  billId: string;
  userId: string;
  householdId: string;
  dueDate: string;
  expectedAmount: number;
  paidAmount: number | null;
  remainingAmount: number | null;
  status: string | null;
  paymentStatus: string | null;
}

/**
 * Process autopay for a single bill instance
 * 
 * This function:
 * 1. Validates the autopay configuration
 * 2. Calculates the payment amount
 * 3. Checks for sufficient funds
 * 4. Creates the appropriate transaction (transfer or expense)
 * 5. Records the payment via processBillPayment()
 * 
 * @param bill - The bill with autopay configuration
 * @param instance - The bill instance to pay
 * @returns AutopayResult with transaction details or error
 */
export async function processAutopayForInstance(
  bill: FullBillData,
  instance: FullInstanceData
): Promise<AutopayResult> {
  const userId = bill.userId;
  const householdId = bill.householdId;
  
  try {
    // Validate prerequisites
    if (instance.status === 'paid' || instance.status === null) {
      return {
        success: false,
        amount: 0,
        error: instance.status === null ? 'Bill instance has invalid status' : 'Bill instance is already paid',
        errorCode: 'ALREADY_PAID',
      };
    }

    if (!bill.isAutopayEnabled) {
      return {
        success: false,
        amount: 0,
        error: 'Autopay is not enabled for this bill',
        errorCode: 'INVALID_CONFIGURATION',
      };
    }

    // Validate autopay configuration
    const configError = validateAutopayConfiguration(
      {
        id: bill.id,
        name: bill.name,
        expectedAmount: bill.expectedAmount,
        autopayAmountType: bill.autopayAmountType,
        autopayFixedAmount: bill.autopayFixedAmount,
        linkedAccountId: bill.linkedAccountId,
        isDebt: bill.isDebt,
      },
      bill.autopayAccountId
    );

    if (configError) {
      return {
        success: false,
        amount: 0,
        error: configError,
        errorCode: 'INVALID_CONFIGURATION',
      };
    }

    // Fetch autopay account (the account paying the bill)
    const [autopayAccountResult] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, bill.autopayAccountId!),
          eq(accounts.userId, userId),
          eq(accounts.householdId, householdId)
        )
      )
      .limit(1);

    if (!autopayAccountResult) {
      return {
        success: false,
        amount: 0,
        error: 'Autopay payment account not found',
        errorCode: 'ACCOUNT_NOT_FOUND',
      };
    }

    // Fetch linked account if this is a credit card payment
    let linkedAccountData: LinkedAccountData | null = null;
    if (bill.linkedAccountId) {
      const [linkedAccountResult] = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, bill.linkedAccountId),
            eq(accounts.userId, userId),
            eq(accounts.householdId, householdId)
          )
        )
        .limit(1);

      if (linkedAccountResult) {
        linkedAccountData = {
          currentBalance: linkedAccountResult.currentBalance,
          statementBalance: linkedAccountResult.statementBalance,
          minimumPaymentAmount: linkedAccountResult.minimumPaymentAmount,
          creditLimit: linkedAccountResult.creditLimit,
        };
      }
    }

    const payingAccountData: PayingAccountData = {
      currentBalance: autopayAccountResult.currentBalance,
      type: autopayAccountResult.type,
    };

    // Calculate payment amount
    const amountResult = calculateAutopayAmount(
      {
        id: bill.id,
        name: bill.name,
        expectedAmount: bill.expectedAmount,
        autopayAmountType: bill.autopayAmountType,
        autopayFixedAmount: bill.autopayFixedAmount,
        linkedAccountId: bill.linkedAccountId,
        isDebt: bill.isDebt,
      },
      {
        expectedAmount: instance.expectedAmount,
        paidAmount: instance.paidAmount,
        remainingAmount: instance.remainingAmount,
      },
      linkedAccountData,
      payingAccountData
    );

    // Check for zero amount (nothing to pay)
    if (amountResult.amount <= 0) {
      return {
        success: true,
        amount: 0,
        amountSource: amountResult.amountSource,
        // Not an error - just nothing to pay
      };
    }

    // Check for insufficient funds
    if (amountResult.insufficientFunds) {
      return {
        success: false,
        amount: amountResult.amount,
        amountSource: amountResult.amountSource,
        error: `Insufficient funds. Required: $${amountResult.amount.toFixed(2)}, Available: $${amountResult.availableBalance.toFixed(2)}`,
        errorCode: 'INSUFFICIENT_FUNDS',
      };
    }

    const paymentAmount = amountResult.amount;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Determine transaction type and create transaction
    let transactionId: string;
    let transferId: string | undefined;

    if (bill.linkedAccountId) {
      // Credit card payment - create transfer
      transferId = nanoid();
      
      // Create transfer_out transaction (from autopay account)
      const transferOutId = nanoid();
      await db.insert(transactions).values({
        id: transferOutId,
        userId,
        householdId,
        accountId: bill.autopayAccountId!,
        date: today,
        amount: paymentAmount,
        description: `Autopay: ${bill.name}`,
        type: 'transfer_out',
        isPending: false,
        transferId,
        createdAt: now,
        updatedAt: now,
      });

      // Create transfer_in transaction (to credit account)
      const transferInId = nanoid();
      await db.insert(transactions).values({
        id: transferInId,
        userId,
        householdId,
        accountId: bill.linkedAccountId,
        date: today,
        amount: paymentAmount,
        description: `Autopay: ${bill.name}`,
        type: 'transfer_in',
        isPending: false,
        transferId,
        createdAt: now,
        updatedAt: now,
      });

      transactionId = transferOutId;

      // Update account balances
      await Promise.all([
        // Decrease autopay account balance (money going out)
        db
          .update(accounts)
          .set({
            currentBalance: new Decimal(autopayAccountResult.currentBalance || 0)
              .minus(paymentAmount)
              .toNumber(),
            updatedAt: now,
          })
          .where(eq(accounts.id, bill.autopayAccountId!)),
        
        // Update credit account balance (reduce debt - balance becomes less negative)
        db
          .update(accounts)
          .set({
            currentBalance: new Decimal(linkedAccountData?.currentBalance || 0)
              .plus(paymentAmount)
              .toNumber(),
            updatedAt: now,
          })
          .where(eq(accounts.id, bill.linkedAccountId)),
      ]);
    } else {
      // Regular bill or loan - create expense
      transactionId = nanoid();
      
      await db.insert(transactions).values({
        id: transactionId,
        userId,
        householdId,
        accountId: bill.autopayAccountId!,
        categoryId: bill.categoryId,
        merchantId: bill.merchantId,
        date: today,
        amount: paymentAmount,
        description: `Autopay: ${bill.name}`,
        type: 'expense',
        isPending: false,
        billId: bill.id, // Link to the bill
        createdAt: now,
        updatedAt: now,
      });

      // Update autopay account balance
      await db
        .update(accounts)
        .set({
          currentBalance: new Decimal(autopayAccountResult.currentBalance || 0)
            .minus(paymentAmount)
            .toNumber(),
          updatedAt: now,
        })
        .where(eq(accounts.id, bill.autopayAccountId!));
    }

    // Process bill payment (updates instance and creates payment record)
    const paymentResult = await processBillPayment({
      billId: bill.id,
      instanceId: instance.id,
      transactionId,
      paymentAmount,
      paymentDate: today,
      userId,
      householdId,
      paymentMethod: 'autopay',
      linkedAccountId: bill.linkedAccountId || undefined,
    });

    if (!paymentResult.success) {
      return {
        success: false,
        amount: paymentAmount,
        amountSource: amountResult.amountSource,
        transactionId,
        transferId,
        error: paymentResult.error || 'Failed to record payment',
        errorCode: 'SYSTEM_ERROR',
      };
    }

    return {
      success: true,
      transactionId,
      transferId,
      amount: paymentAmount,
      amountSource: amountResult.amountSource,
      paymentId: paymentResult.paymentId,
    };
  } catch (error) {
    console.error('Error processing autopay:', error);
    return {
      success: false,
      amount: 0,
      error: error instanceof Error ? error.message : 'Unknown error during autopay processing',
      errorCode: 'SYSTEM_ERROR',
    };
  }
}

