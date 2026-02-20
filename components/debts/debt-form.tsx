'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Info, ChevronDown, ChevronRight } from 'lucide-react';
import { calculateUtilization, getUtilizationLevel, getUtilizationColor } from '@/lib/debts/credit-utilization-utils';
import { getTodayLocalDateString } from '@/lib/utils/local-date';
import type { DebtFormData } from '@/lib/types';

const DEBT_TYPES = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'personal_loan', label: 'Personal Loan' },
  { value: 'student_loan', label: 'Student Loan' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'auto_loan', label: 'Auto Loan' },
  { value: 'medical', label: 'Medical Debt' },
  { value: 'other', label: 'Other' },
];

const DEBT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#ec4899', // pink
  '#a855f7', // purple
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#06b6d4', // cyan
];

const INTEREST_TYPES = [
  { value: 'none', label: 'No Interest' },
  { value: 'fixed', label: 'Fixed Rate' },
  { value: 'variable', label: 'Variable Rate' },
  { value: 'precomputed', label: 'Precomputed (BNPL/Add-On)' },
];

const COMPOUNDING_FREQUENCIES = [
  { value: 'daily', label: 'Daily (Most Credit Cards)' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

// Derive loan type from debt type
const deriveLoanType = (debtType: string): 'revolving' | 'installment' => {
  switch (debtType) {
    case 'credit_card':
      return 'revolving';
    case 'personal_loan':
    case 'student_loan':
    case 'mortgage':
    case 'auto_loan':
      return 'installment';
    case 'medical':
    case 'other':
    default:
      // Medical and Other default to installment (most common for these types)
      return 'installment';
  }
};

interface DebtFormProps {
  debt?: Partial<DebtFormData> | null;
  onSubmit: (data: Partial<DebtFormData>, saveMode?: 'save' | 'saveAndAdd') => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DebtForm({ debt, onSubmit, onCancel, isLoading = false }: DebtFormProps) {
  const [saveMode, setSaveMode] = useState<'save' | 'saveAndAdd' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [extraPaymentExpanded, setExtraPaymentExpanded] = useState(false);
  const [formData, setFormData] = useState({
    name: debt?.name || '',
    description: debt?.description || '',
    creditorName: debt?.creditorName || '',
    originalAmount: debt?.originalAmount || '',
    remainingBalance: debt?.remainingBalance || '',
    minimumPayment: debt?.minimumPayment || '',
    additionalMonthlyPayment: debt?.additionalMonthlyPayment || '',
    interestRate: debt?.interestRate || 0,
    interestType: debt?.interestType || 'none',
    type: debt?.type || 'other',
    color: debt?.color || '#ef4444',
    startDate: debt?.startDate || getTodayLocalDateString(),
    targetPayoffDate: debt?.targetPayoffDate || '',
    priority: debt?.priority || 0,
    // Loan tracking fields
    loanTermMonths: debt?.loanTermMonths || '',
    originationDate: debt?.originationDate || '',
    compoundingFrequency: debt?.compoundingFrequency || 'monthly',
    billingCycleDays: debt?.billingCycleDays || 30,
    lastStatementDate: debt?.lastStatementDate || '',
    lastStatementBalance: debt?.lastStatementBalance || '',
    notes: debt?.notes || '',
    // Credit utilization tracking
    creditLimit: debt?.creditLimit || '',
  });

  // Calculate credit utilization in real-time
  const creditUtilization = useMemo(() => {
    if (formData.type !== 'credit_card') return null;

    const balance = parseFloat(String(formData.remainingBalance)) || 0;
    const limit = parseFloat(String(formData.creditLimit)) || 0;

    if (limit === 0) return null;

    const utilization = calculateUtilization(balance, limit);
    const level = getUtilizationLevel(utilization);
    const color = getUtilizationColor(utilization);

    return { utilization, level, color };
  }, [formData.type, formData.remainingBalance, formData.creditLimit]);

  // Derive loan type from debt type
  const loanType = useMemo(() => deriveLoanType(formData.type), [formData.type]);

  // Check if interest rate field should be shown
  const showInterestRate = formData.interestType !== 'none' && formData.interestType !== 'precomputed';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Debt name is required';
    }

    if (!formData.creditorName.trim()) {
      newErrors.creditorName = 'Creditor name is required';
    }

    if (!formData.originalAmount || parseFloat(String(formData.originalAmount)) <= 0) {
      newErrors.originalAmount = 'Original amount must be greater than 0';
    }

    if (formData.remainingBalance === '' || parseFloat(String(formData.remainingBalance)) < 0) {
      newErrors.remainingBalance = 'Remaining balance is required and must be >= 0';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    // Validate credit limit for credit cards
    if (formData.type === 'credit_card' && formData.creditLimit) {
      const creditLimit = parseFloat(String(formData.creditLimit));
      const balance = parseFloat(String(formData.remainingBalance));

      if (creditLimit < balance) {
        newErrors.creditLimit = 'Credit limit must be >= remaining balance';
      } else if (creditLimit <= 0) {
        newErrors.creditLimit = 'Credit limit must be greater than 0';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSaveMode(null);
      toast.error(Object.values(newErrors)[0]);
      return;
    }

    setErrors({});

    // Set interest rate to 0 for 'none' or 'precomputed' interest types
    const finalInterestRate = showInterestRate ? parseFloat(String(formData.interestRate)) : 0;

    onSubmit({
      ...formData,
      originalAmount: parseFloat(String(formData.originalAmount)),
      remainingBalance: parseFloat(String(formData.remainingBalance)),
      minimumPayment: formData.minimumPayment ? parseFloat(String(formData.minimumPayment)) : undefined,
      additionalMonthlyPayment: formData.additionalMonthlyPayment ? parseFloat(String(formData.additionalMonthlyPayment)) : 0,
      interestRate: finalInterestRate,
      // Loan type derived from debt type
      loanType,
      // Loan structure fields
      loanTermMonths: formData.loanTermMonths ? parseInt(String(formData.loanTermMonths)) : undefined,
      originationDate: formData.originationDate || undefined,
      // Interest calculation fields
      billingCycleDays: formData.billingCycleDays ? parseInt(String(formData.billingCycleDays)) : 30,
      // Credit card fields
      lastStatementDate: formData.lastStatementDate || undefined,
      lastStatementBalance: formData.lastStatementBalance ? parseFloat(String(formData.lastStatementBalance)) : undefined,
      // Credit utilization
      creditLimit: formData.creditLimit ? parseFloat(String(formData.creditLimit)) : undefined,
    }, saveMode || 'save');

    // If save & add another, reset form
    if (saveMode === 'saveAndAdd') {
      const preservedType = formData.type;
      setFormData({
        name: '',
        description: '',
        creditorName: '',
        originalAmount: '',
        remainingBalance: '',
        minimumPayment: '',
        additionalMonthlyPayment: '',
        interestRate: 0,
        interestType: 'none',
        type: preservedType,
        color: '#ef4444',
        startDate: '',
        targetPayoffDate: '',
        priority: 0,
        loanTermMonths: '',
        originationDate: '',
        compoundingFrequency: 'monthly',
        billingCycleDays: 30,
        lastStatementDate: '',
        lastStatementBalance: '',
        notes: '',
        creditLimit: '',
      });
      setSaveMode(null);

      // Focus on name field for quick data entry
      setTimeout(() => {
        document.getElementById('debt-name')?.focus();
      }, 100);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Required fields notice */}
      <p className="text-sm text-muted-foreground">
        Fields marked with <span className="text-error">*</span> are required
      </p>

      {/* Debt Type and Interest Type - at top for dynamic form adjustment */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm mb-1">Debt Type</Label>
          <Select value={formData.type} onValueChange={(v) => handleSelectChange('type', v)}>
            <SelectTrigger className="bg-elevated border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {DEBT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-foreground">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-muted-foreground text-sm mb-1">Interest Type</Label>
          <Select
            value={formData.interestType}
            onValueChange={(v) => handleSelectChange('interestType', v)}
          >
            <SelectTrigger className="bg-elevated border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {INTEREST_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-foreground">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formData.interestType === 'precomputed' && (
            <p className="text-xs text-muted-foreground mt-1">
              For BNPL or add-on interest loans where interest is calculated upfront. Enter the total amount owed (principal + interest) as the Original Amount.
            </p>
          )}
        </div>
      </div>

      {/* Name and Creditor */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className={`text-sm mb-1 ${errors.name ? 'text-error' : 'text-muted-foreground'}`}>
            Debt Name <span className="text-error">*</span>
          </Label>
          <Input
            id="debt-name"
            name="name"
            value={formData.name}
            onChange={(e) => {
              handleChange(e);
              if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
            }}
            placeholder="e.g., Credit Card Debt"
            className={`bg-elevated text-foreground placeholder:text-muted-foreground/50 placeholder:italic ${
              errors.name ? 'border-error' : 'border-border'
            }`}
          />
          {errors.name && (
            <p className="text-error text-xs mt-1">{errors.name}</p>
          )}
        </div>
        <div>
          <Label className={`text-sm mb-1 ${errors.creditorName ? 'text-error' : 'text-muted-foreground'}`}>
            Creditor Name <span className="text-error">*</span>
          </Label>
          <Input
            name="creditorName"
            value={formData.creditorName}
            onChange={(e) => {
              handleChange(e);
              if (errors.creditorName) setErrors(prev => ({ ...prev, creditorName: '' }));
            }}
            placeholder="e.g., Capital One"
            className={`bg-elevated text-foreground placeholder:text-muted-foreground/50 placeholder:italic ${
              errors.creditorName ? 'border-error' : 'border-border'
            }`}
          />
          {errors.creditorName && (
            <p className="text-error text-xs mt-1">{errors.creditorName}</p>
          )}
        </div>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className={`text-sm mb-1 ${errors.originalAmount ? 'text-error' : 'text-muted-foreground'}`}>
            Original Amount <span className="text-error">*</span>
          </Label>
          <Input
            name="originalAmount"
            type="number"
            value={formData.originalAmount}
            onChange={(e) => {
              handleChange(e);
              if (errors.originalAmount) setErrors(prev => ({ ...prev, originalAmount: '' }));
            }}
            placeholder="Enter amount"
            step="0.01"
            min="0.01"
            className={`bg-elevated text-foreground placeholder:text-muted-foreground/50 placeholder:italic ${
              errors.originalAmount ? 'border-error' : 'border-border'
            }`}
          />
          {errors.originalAmount && (
            <p className="text-error text-xs mt-1">{errors.originalAmount}</p>
          )}
        </div>
        <div>
          <Label className={`text-sm mb-1 ${errors.remainingBalance ? 'text-error' : 'text-muted-foreground'}`}>
            Remaining Balance <span className="text-error">*</span>
          </Label>
          <Input
            name="remainingBalance"
            type="number"
            value={formData.remainingBalance}
            onChange={(e) => {
              handleChange(e);
              if (errors.remainingBalance) setErrors(prev => ({ ...prev, remainingBalance: '' }));
            }}
            placeholder="Enter balance"
            step="0.01"
            min="0"
            className={`bg-elevated text-foreground placeholder:text-muted-foreground/50 placeholder:italic ${
              errors.remainingBalance ? 'border-error' : 'border-border'
            }`}
          />
          {errors.remainingBalance && (
            <p className="text-error text-xs mt-1">{errors.remainingBalance}</p>
          )}
        </div>
      </div>

      {/* Credit Limit (Credit Cards Only) */}
      {formData.type === 'credit_card' && (
        <div className="p-4 bg-card rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Label className="text-sm text-primary">Credit Utilization Tracking</Label>
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-muted-foreground text-sm mb-1">Credit Limit (Optional)</Label>
              <Input
                name="creditLimit"
                type="number"
                value={formData.creditLimit}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
              />
              <div className="flex items-start gap-2 mt-2">
                <Info className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Credit utilization is a key factor in credit scores. Experts recommend keeping utilization below 30% per card.
                </p>
              </div>
            </div>

            {/* Real-time Utilization Display */}
            {creditUtilization && (
              <div className="flex items-center justify-between p-3 bg-elevated rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Current Utilization:</span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: creditUtilization.color }}
                  >
                    {creditUtilization.utilization.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs px-2 py-1 rounded-full font-medium border"
                    style={{
                      borderColor: creditUtilization.color,
                      color: creditUtilization.color
                    }}
                  >
                    {creditUtilization.level.charAt(0).toUpperCase() + creditUtilization.level.slice(1)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Info */}
      <div className={`grid gap-4 ${showInterestRate ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div>
          <Label className="text-muted-foreground text-sm mb-1">Minimum Payment (Optional)</Label>
          <Input
            name="minimumPayment"
            type="number"
            value={formData.minimumPayment}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        {showInterestRate && (
          <div>
            <Label className="text-muted-foreground text-sm mb-1">Interest Rate (%)</Label>
            <Input
              name="interestRate"
              type="number"
              value={formData.interestRate}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
        )}
      </div>

      {/* Additional Monthly Payment - Collapsible */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setExtraPaymentExpanded(!extraPaymentExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-elevated/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            {extraPaymentExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <Label className="text-sm text-primary cursor-pointer">Extra Payment Commitment</Label>
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
          {!extraPaymentExpanded && formData.additionalMonthlyPayment && parseFloat(String(formData.additionalMonthlyPayment)) > 0 && (
            <span className="text-sm font-semibold text-income font-mono">
              +${parseFloat(String(formData.additionalMonthlyPayment)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
            </span>
          )}
        </button>
        {extraPaymentExpanded && (
          <div className="px-4 pb-4">
            <Label className="text-muted-foreground text-sm mb-1">Additional Monthly Payment</Label>
            <Input
              name="additionalMonthlyPayment"
              type="number"
              value={formData.additionalMonthlyPayment}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Extra amount you commit to pay beyond the minimum each month. This will be used for more accurate payoff projections.
            </p>
            {formData.minimumPayment && formData.additionalMonthlyPayment && (
              <div className="mt-3 p-3 bg-elevated rounded-lg border border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Planned Payment:</span>
                  <span className="text-sm font-semibold text-income font-mono">
                    ${(parseFloat(String(formData.minimumPayment)) + parseFloat(String(formData.additionalMonthlyPayment))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Installment Loan Fields */}
      {loanType === 'installment' && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-card rounded-lg border border-border">
          <div className="col-span-2">
            <p className="text-sm text-primary mb-3">Installment Loan Details</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-sm mb-1">Loan Term (months)</Label>
            <Input
              name="loanTermMonths"
              type="number"
              value={formData.loanTermMonths}
              onChange={handleChange}
              placeholder="60 for 5-year loan, 360 for 30-year"
              min="1"
              className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Total loan term: 60 months = 5 years, 360 months = 30 years
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground text-sm mb-1">Origination Date</Label>
            <Input
              name="originationDate"
              type="date"
              value={formData.originationDate}
              onChange={handleChange}
              className="bg-elevated border-border text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">When did the loan start?</p>
          </div>
        </div>
      )}

      {/* Revolving Credit Fields */}
      {loanType === 'revolving' && (
        <div className="space-y-4 p-4 bg-card rounded-lg border border-border">
          <div>
            <p className="text-sm text-primary mb-3">Revolving Credit Details</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-sm mb-1">Compounding Frequency</Label>
              <Select
                value={formData.compoundingFrequency}
                onValueChange={(v) => handleSelectChange('compoundingFrequency', v)}
              >
                <SelectTrigger className="bg-elevated border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {COMPOUNDING_FREQUENCIES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-foreground">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">How often does interest compound?</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm mb-1">Billing Cycle (days)</Label>
              <Input
                name="billingCycleDays"
                type="number"
                value={formData.billingCycleDays}
                onChange={handleChange}
                placeholder="30"
                min="28"
                max="31"
                className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">Usually 30 days for credit cards</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-sm mb-1">Last Statement Date</Label>
              <Input
                name="lastStatementDate"
                type="date"
                value={formData.lastStatementDate}
                onChange={handleChange}
                className="bg-elevated border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">Date of last billing statement</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm mb-1">Last Statement Balance</Label>
              <Input
                name="lastStatementBalance"
                type="number"
                value={formData.lastStatementBalance}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">Balance on last statement</p>
            </div>
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className={`text-sm mb-1 ${errors.startDate ? 'text-error' : 'text-muted-foreground'}`}>
            Start Date <span className="text-error">*</span>
          </Label>
          <Input
            name="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => {
              handleChange(e);
              if (errors.startDate) setErrors(prev => ({ ...prev, startDate: '' }));
            }}
            className={`bg-elevated text-foreground ${
              errors.startDate ? 'border-error' : 'border-border'
            }`}
          />
          {errors.startDate && (
            <p className="text-error text-xs mt-1">{errors.startDate}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">When you started tracking this debt in the app</p>
        </div>
        <div>
          <Label className="text-muted-foreground text-sm mb-1">Target Payoff Date (Optional)</Label>
          <Input
            name="targetPayoffDate"
            type="date"
            value={formData.targetPayoffDate}
            onChange={handleChange}
            className="bg-elevated border-border text-foreground"
          />
        </div>
      </div>

      {/* Priority */}
      <div>
        <Label className="text-muted-foreground text-sm mb-1">Priority (Lower = Higher Priority)</Label>
        <Input
          name="priority"
          type="number"
          value={formData.priority}
          onChange={handleChange}
          placeholder="0"
          className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Color Picker */}
      <div>
        <Label className="text-muted-foreground text-sm mb-2">Color</Label>
        <div className="flex gap-2">
          {DEBT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleColorChange(color)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                formData.color === color ? 'border-foreground scale-110' : 'border-border'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <Label className="text-muted-foreground text-sm mb-1">Description (Optional)</Label>
        <Textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Additional details about this debt..."
          className="bg-elevated border-border text-foreground placeholder:text-muted-foreground min-h-20"
        />
      </div>

      {/* Notes */}
      <div>
        <Label className="text-muted-foreground text-sm mb-1">Notes (Optional)</Label>
        <Textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Additional notes..."
          className="bg-elevated border-border text-foreground placeholder:text-muted-foreground min-h-20"
        />
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-4">
        {/* Primary action buttons */}
        <div className="flex gap-2">
          <Button
            type="submit"
            onClick={() => setSaveMode('save')}
            disabled={isLoading}
            className="flex-1 bg-primary text-white hover:opacity-90 font-medium"
          >
            {debt
              ? isLoading && saveMode === 'save'
                ? 'Updating...'
                : 'Update Debt'
              : isLoading && saveMode === 'save'
              ? 'Saving...'
              : 'Save'}
          </Button>
          {!debt && (
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
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="w-full border-border text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
