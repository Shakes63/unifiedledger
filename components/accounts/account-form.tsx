'use client';

import React, { useState } from 'react';
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
import type { AccountFormData, InterestType, PaymentAmountSource } from '@/lib/types';
import { buildAccountSubmitData, validateAccountFormData } from './account-form-utils';

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
  // Budget integration
  includeInDiscretionary?: boolean;
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: account?.name || '',
    type: account?.type || 'checking',
    bankName: account?.bankName || '',
    accountNumberLast4: account?.accountNumberLast4 || '',
    currentBalance: account?.currentBalance || 0,
    creditLimit: account?.creditLimit || '',
    color: account?.color || '#3b82f6',
    icon: account?.icon || 'wallet',
    enableSalesTax: account?.enableSalesTax ?? false,
    enableTaxDeductions: account?.enableTaxDeductions ?? false,
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
    // Budget integration - smart defaults based on account type
    includeInDiscretionary: account?.includeInDiscretionary ?? 
      (account?.type ? ['checking', 'cash'].includes(account.type) : true),
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

    const newErrors = validateAccountFormData(formData);

    // If there are any errors, show them and stop
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSaveMode(null);
      // Show first error as toast
      const firstError = Object.values(newErrors)[0];
      toast.error(firstError);
      return;
    }

    // Clear errors if validation passed
    setErrors({});
    const submitData = buildAccountSubmitData(formData) as Partial<AccountFormData>;

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
        includeInDiscretionary: ['checking', 'cash'].includes(preservedType),
      });
      setSaveMode(null);

      // Focus on name field for quick data entry
      setTimeout(() => {
        document.getElementById('account-name')?.focus();
      }, 100);
    }
  };

  const fs = { backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' };
  const lbl = 'text-[11px] font-medium uppercase tracking-wide block mb-1.5';
  const lblS = { color: 'var(--color-muted-foreground)' };
  const errS = { color: 'var(--color-destructive)' };
  const hint = 'text-[11px] mt-1';
  const hintS = { color: 'var(--color-muted-foreground)', opacity: 0.8 };

  const Toggle = ({ field }: { field: string }) => (
    <button type="button" onClick={() => handleCheckboxChange(field)}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
      style={{ backgroundColor: formData[field as keyof typeof formData] ? 'var(--color-primary)' : 'var(--color-border)' }}>
      <span className="inline-block h-3.5 w-3.5 transform rounded-full transition-transform"
        style={{ backgroundColor: 'var(--color-background)', transform: `translateX(${formData[field as keyof typeof formData] ? '18px' : '2px'})` }} />
    </button>
  );

  const SectionHeader = ({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>, title: string }) => (
    <div className="flex items-center gap-2 pb-3 mb-3" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)' }}>
        <Icon className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
      </div>
      <span className="text-[13px] font-semibold" style={{ color: 'var(--color-foreground)' }}>{title}</span>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name and Type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="account-name" className={lbl} style={errors.name ? errS : lblS}>Account Name*</Label>
          <Input id="account-name" name="name" value={formData.name} onChange={e => { handleChange(e); if (errors.name) setErrors(p => ({ ...p, name: '' })); }}
            placeholder="e.g., My Checking" className="h-9 text-[13px]"
            style={{ ...fs, borderColor: errors.name ? 'var(--color-destructive)' : 'var(--color-border)' }} autoFocus />
          {errors.name && <p className={hint} style={errS}>{errors.name}</p>}
        </div>
        <div>
          <Label className={lbl} style={errors.type ? errS : lblS}>Account Type*</Label>
          <Select value={formData.type} onValueChange={v => { handleSelectChange('type', v); if (errors.type) setErrors(p => ({ ...p, type: '' })); }}>
            <SelectTrigger className="h-9 text-[13px]" style={{ ...fs, borderColor: errors.type ? 'var(--color-destructive)' : 'var(--color-border)' }}><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          {errors.type && <p className={hint} style={errS}>{errors.type}</p>}
        </div>
      </div>

      {/* Bank Name and Account Number */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className={lbl} style={errors.bankName ? errS : lblS}>Bank Name</Label>
          <Input name="bankName" value={formData.bankName} onChange={e => { handleChange(e); if (errors.bankName) setErrors(p => ({ ...p, bankName: '' })); }}
            placeholder="e.g., Chase Bank" className="h-9 text-[13px]"
            style={{ ...fs, borderColor: errors.bankName ? 'var(--color-destructive)' : 'var(--color-border)' }} />
          {errors.bankName && <p className={hint} style={errS}>{errors.bankName}</p>}
        </div>
        <div>
          <Label className={lbl} style={lblS}>Last 4 Digits <span style={{ opacity: 0.6 }}>(optional)</span></Label>
          <Input name="accountNumberLast4" value={formData.accountNumberLast4} onChange={handleChange} placeholder="1234" maxLength={4} className="h-9 text-[13px] tabular-nums" style={fs} />
        </div>
      </div>

      {/* Balance and Credit Limit */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className={lbl} style={lblS}>{isCreditType ? 'Amount Owed' : 'Current Balance'}</Label>
          <Input name="currentBalance" type="number" value={formData.currentBalance} onChange={handleChange} placeholder="0.00" step="0.01" className="h-9 text-[13px] tabular-nums" style={fs} />
          {isCreditType && <p className={hint} style={hintS}>Current balance owed on this account</p>}
        </div>
        {isCreditType && (
          <div>
            <Label className={lbl} style={lblS}>Credit Limit</Label>
            <Input name="creditLimit" type="number" value={formData.creditLimit} onChange={handleChange} placeholder="0.00" step="0.01" className="h-9 text-[13px] tabular-nums" style={fs} />
          </div>
        )}
      </div>

      {/* Credit Card Details */}
      {formData.type === 'credit' && (
        <div className="rounded-xl px-4 py-4 space-y-4" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <SectionHeader icon={CreditCard} title="Credit Card Details" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={lbl} style={lblS}>APR (%)</Label>
              <Input name="interestRate" type="number" value={formData.interestRate} onChange={handleChange} placeholder="0.00" step="0.01" min="0" max="100" className="h-9 text-[13px] tabular-nums" style={fs} />
            </div>
            <div>
              <Label className={lbl} style={errors.statementDueDay ? errS : lblS}>Payment Due Day (1–31)</Label>
              <Input name="statementDueDay" type="number" value={formData.statementDueDay} onChange={e => { handleChange(e); if (errors.statementDueDay) setErrors(p => ({ ...p, statementDueDay: '' })); }}
                placeholder="15" min="1" max="31" className="h-9 text-[13px]" style={{ ...fs, borderColor: errors.statementDueDay ? 'var(--color-destructive)' : 'var(--color-border)' }} />
              {errors.statementDueDay && <p className={hint} style={errS}>{errors.statementDueDay}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={lbl} style={lblS}>Min Payment %</Label>
              <Input name="minimumPaymentPercent" type="number" value={formData.minimumPaymentPercent} onChange={handleChange} placeholder="2.0" step="0.1" min="0" max="100" className="h-9 text-[13px] tabular-nums" style={fs} />
            </div>
            <div>
              <Label className={lbl} style={lblS}>Min Payment Floor ($)</Label>
              <Input name="minimumPaymentFloor" type="number" value={formData.minimumPaymentFloor} onChange={handleChange} placeholder="25" step="1" min="0" className="h-9 text-[13px] tabular-nums" style={fs} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={lbl} style={lblS}>Annual Fee ($)</Label>
              <Input name="annualFee" type="number" value={formData.annualFee} onChange={handleChange} placeholder="0" step="1" min="0" className="h-9 text-[13px] tabular-nums" style={fs} />
            </div>
            <div>
              <Label className={lbl} style={errors.annualFeeMonth ? errS : lblS}>Fee Month</Label>
              <Select value={formData.annualFeeMonth ? String(formData.annualFeeMonth) : ''} onValueChange={v => { handleSelectChange('annualFeeMonth', v); if (errors.annualFeeMonth) setErrors(p => ({ ...p, annualFeeMonth: '' })); }}>
                <SelectTrigger className="h-9 text-[13px]" style={{ ...fs, borderColor: errors.annualFeeMonth ? 'var(--color-destructive)' : 'var(--color-border)' }}><SelectValue placeholder="Select month" /></SelectTrigger>
                <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
              {errors.annualFeeMonth && <p className={hint} style={errS}>{errors.annualFeeMonth}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Line of Credit Details */}
      {formData.type === 'line_of_credit' && (
        <div className="rounded-xl px-4 py-4 space-y-4" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <SectionHeader icon={Landmark} title="Line of Credit Details" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={lbl} style={lblS}>Interest Type</Label>
              <Select value={formData.interestType} onValueChange={v => handleSelectChange('interestType', v)}>
                <SelectTrigger className="h-9 text-[13px]" style={fs}><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent><SelectItem value="fixed">Fixed Rate</SelectItem><SelectItem value="variable">Variable Rate</SelectItem></SelectContent>
              </Select>
            </div>
            {formData.interestType === 'fixed' ? (
              <div>
                <Label className={lbl} style={lblS}>APR (%)</Label>
                <Input name="interestRate" type="number" value={formData.interestRate} onChange={handleChange} placeholder="0.00" step="0.01" min="0" max="100" className="h-9 text-[13px] tabular-nums" style={fs} />
              </div>
            ) : (
              <div>
                <Label className={lbl} style={lblS}>Prime + (%)</Label>
                <Input name="primeRateMargin" type="number" value={formData.primeRateMargin} onChange={handleChange} placeholder="0.00" step="0.01" min="0" className="h-9 text-[13px] tabular-nums" style={fs} />
              </div>
            )}
          </div>
          <div>
            <Label className={lbl} style={errors.statementDueDay ? errS : lblS}>Payment Due Day (1–31)</Label>
            <Input name="statementDueDay" type="number" value={formData.statementDueDay} onChange={e => { handleChange(e); if (errors.statementDueDay) setErrors(p => ({ ...p, statementDueDay: '' })); }}
              placeholder="15" min="1" max="31" className="h-9 text-[13px] w-1/2" style={{ ...fs, borderColor: errors.statementDueDay ? 'var(--color-destructive)' : 'var(--color-border)' }} />
            {errors.statementDueDay && <p className={hint} style={errS}>{errors.statementDueDay}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={lbl} style={lblS}>Min Payment %</Label>
              <Input name="minimumPaymentPercent" type="number" value={formData.minimumPaymentPercent} onChange={handleChange} placeholder="2.0" step="0.1" min="0" max="100" className="h-9 text-[13px] tabular-nums" style={fs} />
            </div>
            <div>
              <Label className={lbl} style={lblS}>Min Payment Floor ($)</Label>
              <Input name="minimumPaymentFloor" type="number" value={formData.minimumPaymentFloor} onChange={handleChange} placeholder="25" step="1" min="0" className="h-9 text-[13px] tabular-nums" style={fs} />
            </div>
          </div>
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Secured Line of Credit</p>
              <p className="text-[11px]" style={hintS}>Secured by an asset (e.g., HELOC)</p>
            </div>
            <Toggle field="isSecured" />
          </div>
          {formData.isSecured && (
            <div>
              <Label className={lbl} style={lblS}>Secured Asset Description</Label>
              <Input name="securedAsset" value={formData.securedAsset} onChange={handleChange} placeholder="e.g., Primary residence at 123 Main St" className="h-9 text-[13px]" style={fs} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={lbl} style={lblS}>Draw Period Ends</Label>
              <Input name="drawPeriodEndDate" type="date" value={formData.drawPeriodEndDate} onChange={handleChange} className="h-9 text-[13px]" style={fs} />
            </div>
            <div>
              <Label className={lbl} style={lblS}>Repayment Period Ends</Label>
              <Input name="repaymentPeriodEndDate" type="date" value={formData.repaymentPeriodEndDate} onChange={handleChange} className="h-9 text-[13px]" style={fs} />
            </div>
          </div>
        </div>
      )}

      {/* Payment Tracking - for credit types */}
      {isCreditType && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
          <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
            <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Payment Tracking</p>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-2">
                <div>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Monthly payment tracking</p>
                  <p className="text-[11px]" style={hintS}>Creates a bill to track payments for this account</p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 mt-0.5 cursor-help shrink-0" style={lblS} />
                    </TooltipTrigger>
                    <TooltipContent><p className="max-w-xs text-[12px]">When enabled, a monthly bill will be created to help you track and remember payments. The bill will appear on your Bills page and calendar.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Toggle field="autoCreatePaymentBill" />
            </div>
            {formData.autoCreatePaymentBill && (
              <div>
                <Label className={lbl} style={lblS}>Default Payment Amount</Label>
                <Select value={formData.paymentAmountSource} onValueChange={v => handleSelectChange('paymentAmountSource', v)}>
                  <SelectTrigger className="h-9 text-[13px]" style={fs}><SelectValue placeholder="Select payment type" /></SelectTrigger>
                  <SelectContent>{PAYMENT_AMOUNT_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className={hint} style={hintS}>
                  {formData.paymentAmountSource === 'statement_balance' && 'Pay the full statement balance to avoid interest'}
                  {formData.paymentAmountSource === 'minimum_payment' && 'Pay only the minimum required (interest will accrue)'}
                  {formData.paymentAmountSource === 'full_balance' && 'Pay the entire current balance'}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)' }}>
              <div className="flex items-start gap-2">
                <div>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Debt payoff strategy</p>
                  <p className="text-[11px]" style={hintS}>Include in snowball/avalanche projections</p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 mt-0.5 cursor-help shrink-0" style={lblS} />
                    </TooltipTrigger>
                    <TooltipContent><p className="max-w-xs text-[12px]">Turn off for cards you pay in full each month or 0% APR promotional balances managed separately.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Toggle field="includeInPayoffStrategy" />
            </div>
          </div>
        </div>
      )}

      {/* Business Features + Budget Integration */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
          <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Features &amp; Tracking</p>
        </div>
        <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
          {[
            { field: 'enableSalesTax', label: 'Sales Tax Tracking', desc: 'Track sales tax on income for quarterly reporting' },
            { field: 'enableTaxDeductions', label: 'Tax Deduction Tracking', desc: 'Mark expenses as business deductions for tax purposes' },
          ].map(({ field, label, desc }) => (
            <div key={field} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>{label}</p>
                <p className="text-[11px]" style={hintS}>{desc}</p>
              </div>
              <Toggle field={field} />
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-start gap-2">
              <div>
                <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Include in Discretionary</p>
                <p className="text-[11px]" style={hintS}>Include balance in paycheck budget calculations</p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 mt-0.5 cursor-help shrink-0" style={lblS} />
                  </TooltipTrigger>
                  <TooltipContent><p className="max-w-xs text-[12px]">Typically enabled for checking/cash accounts, disabled for savings and credit accounts.</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Toggle field="includeInDiscretionary" />
          </div>
        </div>
      </div>

      {/* Color Picker */}
      <div>
        <Label className={lbl} style={lblS}>Account Color</Label>
        <div className="flex gap-2 flex-wrap mt-1">
          {ACCOUNT_COLORS.map(color => (
            <button key={color} type="button" onClick={() => handleColorChange(color)}
              className="w-8 h-8 rounded-lg transition-all"
              style={{ backgroundColor: color, boxShadow: formData.color === color ? `0 0 0 2px var(--color-background), 0 0 0 4px ${color}` : 'none', transform: formData.color === color ? 'scale(1.15)' : 'scale(1)' }}
              title={`Color ${color}`} />
          ))}
        </div>
      </div>

      {/* Icon Picker */}
      <div>
        <Label className={lbl} style={lblS}>Account Icon</Label>
        <div className="flex gap-2 flex-wrap mt-1">
          {ACCOUNT_ICONS.map(iconItem => {
            const Icon = iconItem.icon;
            const active = formData.icon === iconItem.value;
            return (
              <button key={iconItem.value} type="button" onClick={() => handleIconChange(iconItem.value)}
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-all"
                style={{ backgroundColor: active ? 'color-mix(in oklch, var(--color-primary) 12%, transparent)' : 'var(--color-elevated)', border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}` }}
                title={iconItem.label} aria-label={iconItem.label}>
                <Icon className="w-4.5 h-4.5" style={{ color: active ? 'var(--color-primary)' : 'var(--color-muted-foreground)' }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex gap-2">
          <Button type="submit" onClick={() => setSaveMode('save')} disabled={isLoading} className="flex-1 h-9 text-[13px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
            {account ? (isLoading && saveMode === 'save' ? 'Updating…' : 'Update Account') : (isLoading && saveMode === 'save' ? 'Saving…' : 'Save Account')}
          </Button>
          {!account && (
            <Button type="submit" onClick={() => setSaveMode('saveAndAdd')} disabled={isLoading} variant="outline" className="flex-1 h-9 text-[13px]">
              {isLoading && saveMode === 'saveAndAdd' ? 'Saving…' : 'Save & Add Another'}
            </Button>
          )}
        </div>
        {onCancel && <Button type="button" onClick={onCancel} variant="outline" className="w-full h-9 text-[13px]">Cancel</Button>}
      </div>
    </form>
  );
}
