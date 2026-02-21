import type { AccountFormData, InterestType, PaymentAmountSource } from '@/lib/types';

export interface AccountFormState {
  name: string;
  type: string;
  bankName: string;
  accountNumberLast4: string;
  currentBalance: number | string;
  creditLimit: number | string;
  color: string;
  icon: string;
  enableSalesTax: boolean;
  enableTaxDeductions: boolean;
  interestRate: number | string;
  minimumPaymentPercent: number | string;
  minimumPaymentFloor: number | string;
  statementDueDay: number | string;
  annualFee: number | string;
  annualFeeMonth: number | string;
  autoCreatePaymentBill: boolean;
  includeInPayoffStrategy: boolean;
  paymentAmountSource: PaymentAmountSource | string;
  isSecured: boolean;
  securedAsset: string;
  drawPeriodEndDate: string;
  repaymentPeriodEndDate: string;
  interestType: InterestType | string;
  primeRateMargin: number | string;
  includeInDiscretionary: boolean;
}

export function validateAccountFormData(formData: AccountFormState) {
  const errors: Record<string, string> = {};
  if (!formData.name.trim()) errors.name = 'Account name is required';
  if (!formData.type) errors.type = 'Account type is required';
  if (!formData.bankName.trim()) errors.bankName = 'Bank name is required';

  const isCreditAccount = formData.type === 'credit' || formData.type === 'line_of_credit';
  if (isCreditAccount && formData.autoCreatePaymentBill && !formData.statementDueDay) {
    errors.statementDueDay = 'Payment due day is required when payment tracking is enabled';
  }

  if (formData.annualFee && parseFloat(String(formData.annualFee)) > 0 && !formData.annualFeeMonth) {
    errors.annualFeeMonth = 'Fee month is required when annual fee is set';
  }

  return errors;
}

export function buildAccountSubmitData(formData: AccountFormState): Partial<AccountFormData> {
  const isCreditAccount = formData.type === 'credit' || formData.type === 'line_of_credit';
  const submitData: Partial<AccountFormData> = {
    name: formData.name,
    type: formData.type as AccountFormData['type'],
    bankName: formData.bankName || null,
    accountNumberLast4: formData.accountNumberLast4 || null,
    currentBalance: parseFloat(String(formData.currentBalance)) || 0,
    creditLimit: formData.creditLimit ? parseFloat(String(formData.creditLimit)) : null,
    color: formData.color,
    icon: formData.icon,
    isBusinessAccount: formData.enableSalesTax || formData.enableTaxDeductions,
    enableSalesTax: formData.enableSalesTax,
    enableTaxDeductions: formData.enableTaxDeductions,
    includeInDiscretionary: formData.includeInDiscretionary,
  };

  if (isCreditAccount) {
    submitData.interestRate = formData.interestRate ? parseFloat(String(formData.interestRate)) : null;
    submitData.minimumPaymentPercent = formData.minimumPaymentPercent ? parseFloat(String(formData.minimumPaymentPercent)) : null;
    submitData.minimumPaymentFloor = formData.minimumPaymentFloor ? parseFloat(String(formData.minimumPaymentFloor)) : null;
    submitData.statementDueDay = formData.statementDueDay ? parseInt(String(formData.statementDueDay), 10) : null;
    submitData.annualFee = formData.annualFee ? parseFloat(String(formData.annualFee)) : null;
    submitData.annualFeeMonth = formData.annualFeeMonth ? parseInt(String(formData.annualFeeMonth), 10) : null;
    submitData.autoCreatePaymentBill = formData.autoCreatePaymentBill;
    submitData.includeInPayoffStrategy = formData.includeInPayoffStrategy;
    submitData.paymentAmountSource = formData.paymentAmountSource as PaymentAmountSource;

    if (formData.type === 'line_of_credit') {
      submitData.isSecured = formData.isSecured;
      submitData.securedAsset = formData.securedAsset || null;
      submitData.drawPeriodEndDate = formData.drawPeriodEndDate || null;
      submitData.repaymentPeriodEndDate = formData.repaymentPeriodEndDate || null;
      submitData.interestType = formData.interestType as InterestType;
      submitData.primeRateMargin = formData.primeRateMargin ? parseFloat(String(formData.primeRateMargin)) : null;
    }
  }

  return submitData;
}
