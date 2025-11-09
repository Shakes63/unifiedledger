import Decimal from 'decimal.js';

export interface PaymentBreakdown {
  totalPayment: number;
  interestAmount: number;
  principalAmount: number;
}

export interface DebtCalculationParams {
  paymentAmount: number;
  remainingBalance: number;
  annualInterestRate: number;
  interestType: 'fixed' | 'variable' | 'none';
  loanType: 'revolving' | 'installment';
  compoundingFrequency?: 'daily' | 'monthly' | 'quarterly' | 'annually';
  billingCycleDays?: number;
  originalAmount?: number;
  loanTermMonths?: number;
  originationDate?: string;
}

/**
 * Calculate interest for revolving credit (credit cards, lines of credit)
 * Supports daily, monthly, quarterly, and annual compounding
 */
function calculateRevolvingInterest(
  balance: Decimal,
  annualRate: number,
  compoundingFrequency: string = 'monthly',
  billingCycleDays: number = 30
): Decimal {
  const rate = new Decimal(annualRate).dividedBy(100);

  switch (compoundingFrequency) {
    case 'daily':
      // Daily periodic rate × balance × days in billing cycle
      const dailyRate = rate.dividedBy(365);
      return balance.times(dailyRate).times(billingCycleDays);

    case 'quarterly':
      // Quarterly rate (annual ÷ 4)
      const quarterlyRate = rate.dividedBy(4);
      return balance.times(quarterlyRate).dividedBy(3); // Convert to monthly

    case 'annually':
      // Annual rate converted to monthly
      return balance.times(rate).dividedBy(12);

    case 'monthly':
    default:
      // Simple monthly interest
      return balance.times(rate).dividedBy(12);
  }
}

/**
 * Calculate interest for installment loans (mortgages, car loans, personal loans)
 * Uses standard amortization formula
 */
function calculateInstallmentInterest(
  balance: Decimal,
  annualRate: number
): Decimal {
  // For installment loans, interest is always calculated monthly on remaining balance
  const monthlyRate = new Decimal(annualRate).dividedBy(100).dividedBy(12);
  return balance.times(monthlyRate);
}

/**
 * Calculates how a debt payment should be split between interest and principal
 * Handles both revolving credit and installment loans with various compounding frequencies
 */
export function calculatePaymentBreakdown(
  paymentAmount: number,
  remainingBalance: number,
  annualInterestRate: number,
  interestType: 'fixed' | 'variable' | 'none',
  loanType: 'revolving' | 'installment' = 'revolving',
  compoundingFrequency: 'daily' | 'monthly' | 'quarterly' | 'annually' = 'monthly',
  billingCycleDays: number = 30
): PaymentBreakdown {
  // If no interest or 0% rate, entire payment goes to principal
  if (interestType === 'none' || annualInterestRate === 0) {
    return {
      totalPayment: paymentAmount,
      interestAmount: 0,
      principalAmount: paymentAmount,
    };
  }

  const balance = new Decimal(remainingBalance);
  let monthlyInterest: Decimal;

  if (loanType === 'installment') {
    // Amortized loan: simple monthly interest on remaining balance
    monthlyInterest = calculateInstallmentInterest(balance, annualInterestRate);
  } else {
    // Revolving credit: compound according to frequency
    monthlyInterest = calculateRevolvingInterest(
      balance,
      annualInterestRate,
      compoundingFrequency,
      billingCycleDays
    );
  }

  // Round to 2 decimal places for currency
  const interestAmount = monthlyInterest.toDecimalPlaces(2).toNumber();

  // Principal is whatever's left after interest
  const principalAmount = Math.max(0, paymentAmount - interestAmount);

  return {
    totalPayment: paymentAmount,
    interestAmount,
    principalAmount,
  };
}
