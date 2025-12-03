'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Wallet, DollarSign, CreditCard, TrendingUp, Coins, Building2, PiggyBank, Briefcase, Landmark, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { AccountFormData, AccountType, PaymentAmountSource, InterestType } from '@/lib/types';

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking', icon: Wallet },
  { value: 'savings', label: 'Savings', icon: TrendingUp },
  { value: 'credit', label: 'Credit Card', icon: CreditCard },
  { value: 'line_of_credit', label: 'Line of Credit', icon: Landmark },
  { value: 'investment', label: 'Investment', icon: DollarSign },
  { value: 'cash', label: 'Cash', icon: Coins },
];

const PAYMENT_AMOUNT_SOURCES = [
  { value: 'statement_balance', label: 'Statement Balance' },
  { value: 'minimum_payment', label: 'Minimum Payment' },
  { value: 'full_balance', label: 'Full Balance' },
];

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const ACCOUNT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

const ACCOUNT_ICONS = [
  { value: 'wallet', label: 'Wallet', icon: Wallet },
  { value: 'bank', label: 'Bank', icon: Building2 },
  { value: 'credit-card', label: 'Credit Card', icon: CreditCard },
  { value: 'piggy-bank', label: 'Piggy Bank', icon: PiggyBank },
  { value: 'trending-up', label: 'Trending Up', icon: TrendingUp },
  { value: 'dollar-sign', label: 'Dollar Sign', icon: DollarSign },
  { value: 'coins', label: 'Coins', icon: Coins },
  { value: 'briefcase', label: 'Briefcase', icon: Briefcase },
];

// Accept both API entity and form data formats
interface AccountInputData {
  name?: string;
  type?: string;
  bankName?: string | null;
  accountNumberLast4?: string | null;
  currentBalance?: number;
  creditLimit?: string | number | null;
  color?: string;
  icon?: string;
  isBusinessAccount?: boolean;
  enableSalesTax?: boolean;
  enableTaxDeductions?: boolean;
  // Credit/Line of Credit fields
  interestRate?: number | null;
  minimumPaymentPercent?: number | null;
  minimumPaymentFloor?: number | null;
  statementDueDay?: number | null;
  annualFee?: number | null;
  annualFeeMonth?: number | null;
  autoCreatePaymentBill?: boolean;
  includeInPayoffStrategy?: boolean;
  paymentAmountSource?: PaymentAmountSource;
  // Line of Credit specific fields
  isSecured?: boolean;
  securedAsset?: string | null;
  drawPeriodEndDate?: string | null;
  repaymentPeriodEndDate?: string | null;
  interestType?: InterestType;
  primeRateMargin?: number | null;
}

interface AccountFormProps {
  account?: AccountInputData | null;
  onSubmit: (data: Partial<AccountFormData>, saveMode?: 'save' | 'saveAndAdd') => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function AccountForm({
  account,
  onSubmit,
  onCancel,
  isLoading = false,
}: AccountFormProps) {
  const [saveMode, setSaveMode] = useState<'save' | 'saveAndAdd' | null>(null);
  const [formData, setFormData] = useState({
    name: account?.name || '',
    type: account?.type || 'checking',
    bankName: account?.bankName || '',
    accountNumberLast4: account?.accountNumberLast4 || '',
    currentBalance: account?.currentBalance || 0,
    creditLimit: account?.creditLimit || '',
    color: account?.color || '#3b82f6',
    icon: account?.icon || 'wallet',
    // Support both new toggles and legacy isBusinessAccount
    enableSalesTax: account?.enableSalesTax ?? account?.isBusinessAccount ?? false,
    enableTaxDeductions: account?.enableTaxDeductions ?? account?.isBusinessAccount ?? false,
    // Credit/Line of Credit fields
    interestRate: account?.interestRate ?? '',
    minimumPaymentPercent: account?.minimumPaymentPercent ?? '',
    minimumPaymentFloor: account?.minimumPaymentFloor ?? '',
    statementDueDay: account?.statementDueDay ?? '',
    annualFee: account?.annualFee ?? '',
    annualFeeMonth: account?.annualFeeMonth ?? '',
    autoCreatePaymentBill: account?.autoCreatePaymentBill ?? true,
    includeInPayoffStrategy: account?.includeInPayoffStrategy ?? true,
    paymentAmountSource: account?.paymentAmountSource ?? 'statement_balance',
    // Line of Credit specific fields
    isSecured: account?.isSecured ?? false,
    securedAsset: account?.securedAsset ?? '',
    drawPeriodEndDate: account?.drawPeriodEndDate ?? '',
    repaymentPeriodEndDate: account?.repaymentPeriodEndDate ?? '',
    interestType: account?.interestType ?? 'fixed',
    primeRateMargin: account?.primeRateMargin ?? '',
  });

  // Helper to check if account type is credit-related
  const isCreditType = formData.type === 'credit' || formData.type === 'line_of_credit';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name.includes('Balance') || name.includes('creditLimit')
        ? parseFloat(value) || ''
        : value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleColorChange = (color: string) => {
    setFormData((prev) => ({
      ...prev,
      color,
    }));
  };

  const handleIconChange = (icon: string) => {
    setFormData((prev) => ({
      ...prev,
      icon,
    }));
  };

  const handleCheckboxChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: !prev[name as keyof typeof prev],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Account name is required');
      setSaveMode(null);
      return;
    }

    if (!formData.type) {
      toast.error('Account type is required');
      setSaveMode(null);
      return;
    }

    // Validation for credit accounts
    const isCreditAccount = formData.type === 'credit' || formData.type === 'line_of_credit';
    
    if (isCreditAccount && formData.autoCreatePaymentBill && !formData.statementDueDay) {
      toast.error('Payment due day is required when payment tracking is enabled');
      setSaveMode(null);
      return;
    }

    if (formData.annualFee && parseFloat(String(formData.annualFee)) > 0 && !formData.annualFeeMonth) {
      toast.error('Annual fee month is required when annual fee is set');
      setSaveMode(null);
      return;
    }

    const submitData: Partial<AccountFormData> = {
      name: formData.name,
      type: formData.type as AccountType,
      bankName: formData.bankName || null,
      accountNumberLast4: formData.accountNumberLast4 || null,
      currentBalance: parseFloat(String(formData.currentBalance)) || 0,
      creditLimit: formData.creditLimit ? parseFloat(String(formData.creditLimit)) : null,
      color: formData.color,
      icon: formData.icon,
      // Compute isBusinessAccount from toggles for backward compatibility
      isBusinessAccount: formData.enableSalesTax || formData.enableTaxDeductions,
      enableSalesTax: formData.enableSalesTax,
      enableTaxDeductions: formData.enableTaxDeductions,
    };

    // Add credit/line of credit fields if applicable
    if (isCreditAccount) {
      submitData.interestRate = formData.interestRate ? parseFloat(String(formData.interestRate)) : null;
      submitData.minimumPaymentPercent = formData.minimumPaymentPercent ? parseFloat(String(formData.minimumPaymentPercent)) : null;
      submitData.minimumPaymentFloor = formData.minimumPaymentFloor ? parseFloat(String(formData.minimumPaymentFloor)) : null;
      submitData.statementDueDay = formData.statementDueDay ? parseInt(String(formData.statementDueDay)) : null;
      submitData.annualFee = formData.annualFee ? parseFloat(String(formData.annualFee)) : null;
      submitData.annualFeeMonth = formData.annualFeeMonth ? parseInt(String(formData.annualFeeMonth)) : null;
      submitData.autoCreatePaymentBill = formData.autoCreatePaymentBill;
      submitData.includeInPayoffStrategy = formData.includeInPayoffStrategy;
      submitData.paymentAmountSource = formData.paymentAmountSource as PaymentAmountSource;
      
      // Line of Credit specific fields
      if (formData.type === 'line_of_credit') {
        submitData.isSecured = formData.isSecured;
        submitData.securedAsset = formData.securedAsset || null;
        submitData.drawPeriodEndDate = formData.drawPeriodEndDate || null;
        submitData.repaymentPeriodEndDate = formData.repaymentPeriodEndDate || null;
        submitData.interestType = formData.interestType as InterestType;
        submitData.primeRateMargin = formData.primeRateMargin ? parseFloat(String(formData.primeRateMargin)) : null;
      }
    }

    onSubmit(submitData, saveMode || 'save');

    // If save & add another, reset form
    if (saveMode === 'saveAndAdd') {
      const preservedType = formData.type;
      setFormData({
        name: '',
        type: preservedType,
        bankName: '',
        accountNumberLast4: '',
        currentBalance: 0,
        creditLimit: '',
        color: '#3b82f6',
        icon: 'wallet',
        enableSalesTax: false,
        enableTaxDeductions: false,
        interestRate: '',
        minimumPaymentPercent: '',
        minimumPaymentFloor: '',
        statementDueDay: '',
        annualFee: '',
        annualFeeMonth: '',
        autoCreatePaymentBill: true,
        includeInPayoffStrategy: true,
        paymentAmountSource: 'statement_balance',
        isSecured: false,
        securedAsset: '',
        drawPeriodEndDate: '',
        repaymentPeriodEndDate: '',
        interestType: 'fixed',
        primeRateMargin: '',
      });
      setSaveMode(null);

      // Focus on name field for quick data entry
      setTimeout(() => {
        document.getElementById('account-name')?.focus();
      }, 100);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name and Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Account Name</Label>
          <Input
            id="account-name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., My Checking"
            className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Account Type</Label>
          <Select value={formData.type} onValueChange={(value) => handleSelectChange('type', value)}>
            <SelectTrigger className="bg-elevated border-border text-foreground">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bank Name and Account Number */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Bank Name (Optional)</Label>
          <Input
            name="bankName"
            value={formData.bankName}
            onChange={handleChange}
            placeholder="e.g., Chase Bank"
            className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Last 4 Digits (Optional)</Label>
          <Input
            name="accountNumberLast4"
            value={formData.accountNumberLast4}
            onChange={handleChange}
            placeholder="1234"
            maxLength={4}
            className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Balance and Credit Limit */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">
            {isCreditType ? 'Amount Owed' : 'Current Balance'}
          </Label>
          <Input
            name="currentBalance"
            type="number"
            value={formData.currentBalance}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
          {isCreditType && (
            <p className="text-xs text-muted-foreground mt-1">Enter the current balance owed on this account</p>
          )}
        </div>
        {isCreditType && (
          <div>
            <Label className="text-muted-foreground text-sm mb-2 block">Credit Limit</Label>
            <Input
              name="creditLimit"
              type="number"
              value={formData.creditLimit}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
        )}
      </div>

      {/* Credit Card Details Section */}
      {formData.type === 'credit' && (
        <div className="p-4 bg-card rounded-lg border border-border space-y-4">
          <div className="text-sm font-medium text-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[var(--color-primary)]" />
            Credit Card Details
          </div>
          
          {/* APR and Payment Due Day */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">APR (%)</Label>
              <Input
                name="interestRate"
                type="number"
                value={formData.interestRate}
                onChange={handleChange}
                placeholder="19.99"
                step="0.01"
                min="0"
                max="100"
                className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Payment Due Day (1-31)</Label>
              <Input
                name="statementDueDay"
                type="number"
                value={formData.statementDueDay}
                onChange={handleChange}
                placeholder="15"
                min="1"
                max="31"
                className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
          
          {/* Minimum Payment Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Min Payment %</Label>
              <Input
                name="minimumPaymentPercent"
                type="number"
                value={formData.minimumPaymentPercent}
                onChange={handleChange}
                placeholder="2"
                step="0.1"
                min="0"
                max="100"
                className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Min Payment Floor ($)</Label>
              <Input
                name="minimumPaymentFloor"
                type="number"
                value={formData.minimumPaymentFloor}
                onChange={handleChange}
                placeholder="25"
                step="1"
                min="0"
                className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
          
          {/* Annual Fee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Annual Fee ($)</Label>
              <Input
                name="annualFee"
                type="number"
                value={formData.annualFee}
                onChange={handleChange}
                placeholder="0"
                step="1"
                min="0"
                className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Fee Month</Label>
              <Select 
                value={formData.annualFeeMonth ? String(formData.annualFeeMonth) : ''} 
                onValueChange={(value) => handleSelectChange('annualFeeMonth', value)}
              >
                <SelectTrigger className="bg-elevated border-border text-foreground">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Line of Credit Details Section */}
      {formData.type === 'line_of_credit' && (
        <div className="p-4 bg-card rounded-lg border border-border space-y-4">
          <div className="text-sm font-medium text-foreground flex items-center gap-2">
            <Landmark className="h-4 w-4 text-[var(--color-primary)]" />
            Line of Credit Details
          </div>
          
          {/* Interest Type and Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Interest Type</Label>
              <Select 
                value={formData.interestType} 
                onValueChange={(value) => handleSelectChange('interestType', value)}
              >
                <SelectTrigger className="bg-elevated border-border text-foreground">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Rate</SelectItem>
                  <SelectItem value="variable">Variable Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.interestType === 'fixed' ? (
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">APR (%)</Label>
                <Input
                  name="interestRate"
                  type="number"
                  value={formData.interestRate}
                  onChange={handleChange}
                  placeholder="8.99"
                  step="0.01"
                  min="0"
                  max="100"
                  className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            ) : (
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Prime + (%)</Label>
                <Input
                  name="primeRateMargin"
                  type="number"
                  value={formData.primeRateMargin}
                  onChange={handleChange}
                  placeholder="1.5"
                  step="0.01"
                  min="0"
                  className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            )}
          </div>

          {/* Payment Due Day */}
          <div>
            <Label className="text-muted-foreground text-sm mb-2 block">Payment Due Day (1-31)</Label>
            <Input
              name="statementDueDay"
              type="number"
              value={formData.statementDueDay}
              onChange={handleChange}
              placeholder="15"
              min="1"
              max="31"
              className="bg-elevated border-border text-foreground placeholder:text-muted-foreground w-1/2"
            />
          </div>
          
          {/* Minimum Payment Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Min Payment %</Label>
              <Input
                name="minimumPaymentPercent"
                type="number"
                value={formData.minimumPaymentPercent}
                onChange={handleChange}
                placeholder="2"
                step="0.1"
                min="0"
                max="100"
                className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Min Payment Floor ($)</Label>
              <Input
                name="minimumPaymentFloor"
                type="number"
                value={formData.minimumPaymentFloor}
                onChange={handleChange}
                placeholder="25"
                step="1"
                min="0"
                className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
          
          {/* Secured LOC Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-muted-foreground text-sm block font-medium">Secured Line of Credit</Label>
              <p className="text-xs text-muted-foreground mt-1">This line of credit is secured by an asset (e.g., HELOC)</p>
            </div>
            <button
              type="button"
              onClick={() => handleCheckboxChange('isSecured')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.isSecured ? 'bg-[var(--color-primary)]' : 'bg-elevated'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.isSecured ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {formData.isSecured && (
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Secured Asset Description</Label>
              <Input
                name="securedAsset"
                value={formData.securedAsset}
                onChange={handleChange}
                placeholder="e.g., Primary residence at 123 Main St"
                className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          )}
          
          {/* Draw and Repayment Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Draw Period Ends</Label>
              <Input
                name="drawPeriodEndDate"
                type="date"
                value={formData.drawPeriodEndDate}
                onChange={handleChange}
                className="bg-elevated border-border text-foreground"
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Repayment Period Ends</Label>
              <Input
                name="repaymentPeriodEndDate"
                type="date"
                value={formData.repaymentPeriodEndDate}
                onChange={handleChange}
                className="bg-elevated border-border text-foreground"
              />
            </div>
          </div>
        </div>
      )}

      {/* Payment Tracking Section - for credit types */}
      {isCreditType && (
        <div className="p-4 bg-card rounded-lg border border-border space-y-4">
          <div className="text-sm font-medium text-foreground">Payment Tracking</div>
          
          {/* Set up payment tracking toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-2">
              <div>
                <Label className="text-muted-foreground text-sm block font-medium">Set up monthly payment tracking</Label>
                <p className="text-xs text-muted-foreground mt-1">Automatically creates a bill to track payments for this account</p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help mt-0.5" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">When enabled, a monthly bill will be created to help you track and remember payments for this account. The bill will appear on your Bills page and calendar.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <button
              type="button"
              onClick={() => handleCheckboxChange('autoCreatePaymentBill')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.autoCreatePaymentBill ? 'bg-[var(--color-primary)]' : 'bg-elevated'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.autoCreatePaymentBill ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {/* Payment amount source - only show if tracking enabled */}
          {formData.autoCreatePaymentBill && (
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Default Payment Amount</Label>
              <Select 
                value={formData.paymentAmountSource} 
                onValueChange={(value) => handleSelectChange('paymentAmountSource', value)}
              >
                <SelectTrigger className="bg-elevated border-border text-foreground">
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_AMOUNT_SOURCES.map((source) => (
                    <SelectItem key={source.value} value={source.value}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.paymentAmountSource === 'statement_balance' && 'Pay the full statement balance to avoid interest charges'}
                {formData.paymentAmountSource === 'minimum_payment' && 'Pay only the minimum required (interest will accrue)'}
                {formData.paymentAmountSource === 'full_balance' && 'Pay the entire current balance'}
              </p>
            </div>
          )}
          
          {/* Include in payoff strategy toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-2">
              <div>
                <Label className="text-muted-foreground text-sm block font-medium">Include in debt payoff strategy</Label>
                <p className="text-xs text-muted-foreground mt-1">Calculate payoff projections and include in snowball/avalanche strategies</p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help mt-0.5" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Turn off for cards you pay in full each month or 0% APR promotional balances that you are managing separately.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <button
              type="button"
              onClick={() => handleCheckboxChange('includeInPayoffStrategy')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.includeInPayoffStrategy ? 'bg-[var(--color-primary)]' : 'bg-elevated'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.includeInPayoffStrategy ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Business Features Section */}
      <div className="p-4 bg-card rounded-lg border border-border space-y-4">
        <div className="text-sm font-medium text-foreground">Business Features</div>
        
        {/* Sales Tax Tracking Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-muted-foreground text-sm block font-medium">Sales Tax Tracking</Label>
            <p className="text-xs text-muted-foreground mt-1">Track sales tax on income for quarterly reporting</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('enableSalesTax')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.enableSalesTax ? 'bg-[var(--color-primary)]' : 'bg-elevated'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.enableSalesTax ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        
        {/* Tax Deduction Tracking Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-muted-foreground text-sm block font-medium">Tax Deduction Tracking</Label>
            <p className="text-xs text-muted-foreground mt-1">Mark expenses as business deductions for tax purposes</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('enableTaxDeductions')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.enableTaxDeductions ? 'bg-[var(--color-primary)]' : 'bg-elevated'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.enableTaxDeductions ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Color Picker */}
      <div>
        <Label className="text-muted-foreground text-sm mb-2 block">Account Color</Label>
        <div className="flex gap-2 flex-wrap">
          {ACCOUNT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleColorChange(color)}
              className={`w-10 h-10 rounded-lg border-2 transition-all ${
                formData.color === color
                  ? 'border-foreground ring-2 ring-[var(--color-primary)] scale-110'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
              title={`Color ${color}`}
            />
          ))}
        </div>
      </div>

      {/* Icon Picker */}
      <div>
        <Label className="text-muted-foreground text-sm mb-2 block">Account Icon</Label>
        <div className="flex gap-2 flex-wrap">
          {ACCOUNT_ICONS.map((iconItem) => {
            const IconComponent = iconItem.icon;
            return (
              <button
                key={iconItem.value}
                type="button"
                onClick={() => handleIconChange(iconItem.value)}
                className={`w-12 h-12 rounded-lg border-2 transition-all flex items-center justify-center ${
                  formData.icon === iconItem.value
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-border bg-elevated text-muted-foreground hover:bg-elevated hover:border-[var(--color-primary)]/30'
                }`}
                title={iconItem.label}
                aria-label={iconItem.label}
              >
                <IconComponent className="w-6 h-6" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-4 border-t border-border">
        {/* Primary action buttons */}
        <div className="flex gap-2">
          <Button
            type="submit"
            onClick={() => setSaveMode('save')}
            disabled={isLoading}
            className="flex-1 bg-[var(--color-primary)] text-white hover:opacity-90 font-medium"
          >
            {account
              ? isLoading && saveMode === 'save'
                ? 'Updating...'
                : 'Update Account'
              : isLoading && saveMode === 'save'
              ? 'Saving...'
              : 'Save'}
          </Button>
          {!account && (
            <Button
              type="submit"
              onClick={() => setSaveMode('saveAndAdd')}
              disabled={isLoading}
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 font-medium"
            >
              {isLoading && saveMode === 'saveAndAdd' ? 'Saving...' : 'Save & Add Another'}
            </Button>
          )}
        </div>
        {/* Cancel button */}
        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            className="w-full bg-elevated border-border text-foreground hover:bg-elevated"
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
