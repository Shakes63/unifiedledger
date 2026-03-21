import Decimal from 'decimal.js';

export interface DiscretionaryCalculationInput {
  includedBalance: number;
  expectedIncome: number;
  actualIncome: number;
  billsPending: number;
  budgetRemaining: number;
}

export interface DiscretionaryCalculationResult {
  currentDiscretionary: number;
  projectedDiscretionary: number;
  expectedDiscretionary: number;
  variance: number;
}

/**
 * Calculates discretionary amounts without double-counting posted activity.
 *
 * Account balances already include posted income and paid expenses, so this
 * only applies *remaining* period obligations and remaining expected income.
 */
export function calculateDiscretionaryAmounts(
  input: DiscretionaryCalculationInput
): DiscretionaryCalculationResult {
  const remainingIncome = Decimal.max(
    new Decimal(input.expectedIncome).minus(input.actualIncome),
    0
  );
  const budgetReserveRemaining = Math.max(0, input.budgetRemaining);

  const currentDiscretionary = new Decimal(input.includedBalance)
    .minus(input.billsPending)
    .minus(budgetReserveRemaining)
    .toDecimalPlaces(2)
    .toNumber();

  const projectedDiscretionary = new Decimal(currentDiscretionary)
    .plus(remainingIncome)
    .toDecimalPlaces(2)
    .toNumber();

  return {
    currentDiscretionary,
    projectedDiscretionary,
    expectedDiscretionary: projectedDiscretionary,
    variance: new Decimal(projectedDiscretionary)
      .minus(currentDiscretionary)
      .toDecimalPlaces(2)
      .toNumber(),
  };
}
