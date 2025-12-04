/**
 * Autopay Amount Calculator
 * 
 * Calculates the correct payment amount based on the bill's autopay configuration:
 * - fixed: Use the configured fixed amount
 * - minimum_payment: Use the credit account's minimum payment amount
 * - statement_balance: Use the credit account's statement balance
 * - full_balance: Use the credit account's current full balance
 */

import Decimal from 'decimal.js';
import { accounts, bills, billInstances } from '@/lib/db/schema';

export type AutopayAmountType = 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance';

export interface AutopayAmountResult {
  amount: number;
  amountSource: string;
  minimumRequired: number;
  insufficientFunds: boolean;
  availableBalance: number;
}

export interface BillForAutopay {
  id: string;
  name: string;
  expectedAmount: number;
  autopayAmountType: AutopayAmountType | null;
  autopayFixedAmount: number | null;
  linkedAccountId: string | null;
  isDebt: boolean | null;
}

export interface LinkedAccountData {
  currentBalance: number | null;
  statementBalance: number | null;
  minimumPaymentAmount: number | null;
  creditLimit: number | null;
}

export interface PayingAccountData {
  currentBalance: number | null;
  type: string;
}

export interface BillInstanceForAutopay {
  expectedAmount: number;
  paidAmount: number | null;
  remainingAmount: number | null;
}

/**
 * Calculate the autopay amount based on bill configuration and account data
 * 
 * @param bill - The bill with autopay configuration
 * @param instance - The bill instance to pay
 * @param linkedAccount - Data from the linked credit account (if any)
 * @param payingAccount - Data from the account paying the bill
 * @returns AutopayAmountResult with amount and metadata
 */
export function calculateAutopayAmount(
  bill: BillForAutopay,
  instance: BillInstanceForAutopay,
  linkedAccount: LinkedAccountData | null,
  payingAccount: PayingAccountData
): AutopayAmountResult {
  const payingAccountBalance = new Decimal(payingAccount.currentBalance || 0);
  
  // Calculate remaining amount if partially paid
  const remainingToPay = instance.remainingAmount !== null 
    ? instance.remainingAmount 
    : instance.expectedAmount - (instance.paidAmount || 0);
  
  let amount: number;
  let amountSource: string;
  let minimumRequired: number = remainingToPay;

  switch (bill.autopayAmountType) {
    case 'fixed':
      // Use the configured fixed amount
      amount = bill.autopayFixedAmount || instance.expectedAmount;
      amountSource = 'Fixed Amount';
      break;

    case 'minimum_payment':
      // For linked credit accounts, use minimum payment from account
      // For other bills, use the expected amount (which is typically the minimum)
      if (linkedAccount?.minimumPaymentAmount !== null && linkedAccount?.minimumPaymentAmount !== undefined) {
        amount = linkedAccount.minimumPaymentAmount;
        amountSource = 'Minimum Payment';
        minimumRequired = linkedAccount.minimumPaymentAmount;
      } else {
        // Fall back to expected amount for non-credit bills
        amount = remainingToPay;
        amountSource = 'Minimum Payment (Expected)';
      }
      break;

    case 'statement_balance':
      // For linked credit accounts, use statement balance
      if (linkedAccount?.statementBalance !== null && linkedAccount?.statementBalance !== undefined) {
        // Statement balance is typically positive for what's owed
        amount = Math.abs(linkedAccount.statementBalance);
        amountSource = 'Statement Balance';
        
        // Minimum required is still the minimum payment
        if (linkedAccount.minimumPaymentAmount !== null && linkedAccount.minimumPaymentAmount !== undefined) {
          minimumRequired = linkedAccount.minimumPaymentAmount;
        }
      } else {
        // Fall back to expected amount
        amount = remainingToPay;
        amountSource = 'Statement Balance (Expected)';
      }
      break;

    case 'full_balance':
      // For linked credit accounts, pay the full current balance
      if (linkedAccount?.currentBalance !== null && linkedAccount?.currentBalance !== undefined) {
        // Credit card balances are negative in our schema (debt)
        // Use absolute value to get the amount owed
        amount = Math.abs(linkedAccount.currentBalance);
        amountSource = 'Full Balance';
        
        // Minimum required is still the minimum payment
        if (linkedAccount.minimumPaymentAmount !== null && linkedAccount.minimumPaymentAmount !== undefined) {
          minimumRequired = linkedAccount.minimumPaymentAmount;
        }
      } else {
        // Fall back to expected amount
        amount = remainingToPay;
        amountSource = 'Full Balance (Expected)';
      }
      break;

    default:
      // No autopay type set, use expected amount
      amount = remainingToPay;
      amountSource = 'Expected Amount';
  }

  // Round to 2 decimal places for currency
  amount = new Decimal(amount).toDecimalPlaces(2).toNumber();
  minimumRequired = new Decimal(minimumRequired).toDecimalPlaces(2).toNumber();

  // Special case: if amount is 0 or negative, there's nothing to pay
  // This can happen with full_balance if account has a credit (overpayment)
  if (amount <= 0) {
    return {
      amount: 0,
      amountSource: `${amountSource} (Nothing Owed)`,
      minimumRequired: 0,
      insufficientFunds: false,
      availableBalance: payingAccountBalance.toNumber(),
    };
  }

  // Check if paying account has sufficient funds
  // For checking/savings, balance should be >= amount
  // For credit cards paying bills (unusual), use available credit
  const insufficientFunds = payingAccountBalance.lessThan(amount);

  return {
    amount,
    amountSource,
    minimumRequired,
    insufficientFunds,
    availableBalance: payingAccountBalance.toNumber(),
  };
}

/**
 * Get a human-readable description of the autopay configuration
 */
export function getAutopayDescription(
  autopayAmountType: AutopayAmountType | null,
  autopayFixedAmount: number | null,
  autopayDaysBefore: number | null
): string {
  let amountDesc: string;
  
  switch (autopayAmountType) {
    case 'fixed':
      amountDesc = autopayFixedAmount 
        ? `$${autopayFixedAmount.toFixed(2)} fixed`
        : 'Fixed amount';
      break;
    case 'minimum_payment':
      amountDesc = 'Minimum payment';
      break;
    case 'statement_balance':
      amountDesc = 'Statement balance';
      break;
    case 'full_balance':
      amountDesc = 'Full balance';
      break;
    default:
      amountDesc = 'Expected amount';
  }

  const daysDesc = autopayDaysBefore === 0 
    ? 'on due date'
    : autopayDaysBefore === 1
      ? '1 day before due'
      : `${autopayDaysBefore} days before due`;

  return `${amountDesc} ${daysDesc}`;
}

/**
 * Validate that autopay can be processed for a bill
 * Returns null if valid, or an error message if invalid
 */
export function validateAutopayConfiguration(
  bill: BillForAutopay,
  autopayAccountId: string | null
): string | null {
  if (!autopayAccountId) {
    return 'No payment account configured for autopay';
  }

  if (bill.autopayAmountType === 'fixed' && 
      (bill.autopayFixedAmount === null || bill.autopayFixedAmount <= 0)) {
    return 'Fixed autopay amount must be greater than zero';
  }

  // For credit card payments, must have linkedAccountId
  if (bill.linkedAccountId === null && 
      (bill.autopayAmountType === 'minimum_payment' || 
       bill.autopayAmountType === 'statement_balance' ||
       bill.autopayAmountType === 'full_balance')) {
    // This is okay for non-credit bills - they'll use expected amount
  }

  return null;
}

