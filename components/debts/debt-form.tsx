'use client';

import { useState } from 'react';
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
];

const LOAN_TYPES = [
  { value: 'revolving', label: 'Revolving Credit (Credit Card, Line of Credit)' },
  { value: 'installment', label: 'Installment Loan (Car, Mortgage, Personal)' },
];

const COMPOUNDING_FREQUENCIES = [
  { value: 'daily', label: 'Daily (Most Credit Cards)' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

interface DebtFormProps {
  debt?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DebtForm({ debt, onSubmit, onCancel, isLoading = false }: DebtFormProps) {
  const [formData, setFormData] = useState({
    name: debt?.name || '',
    description: debt?.description || '',
    creditorName: debt?.creditorName || '',
    originalAmount: debt?.originalAmount || '',
    remainingBalance: debt?.remainingBalance || '',
    minimumPayment: debt?.minimumPayment || '',
    interestRate: debt?.interestRate || 0,
    interestType: debt?.interestType || 'none',
    type: debt?.type || 'other',
    color: debt?.color || '#ef4444',
    startDate: debt?.startDate || '',
    targetPayoffDate: debt?.targetPayoffDate || '',
    priority: debt?.priority || 0,
    // New loan tracking fields
    loanType: debt?.loanType || 'revolving',
    loanTermMonths: debt?.loanTermMonths || '',
    originationDate: debt?.originationDate || '',
    compoundingFrequency: debt?.compoundingFrequency || 'monthly',
    billingCycleDays: debt?.billingCycleDays || 30,
    lastStatementDate: debt?.lastStatementDate || '',
    lastStatementBalance: debt?.lastStatementBalance || '',
    notes: debt?.notes || '',
  });

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

    if (!formData.name.trim()) {
      toast.error('Debt name is required');
      return;
    }

    if (!formData.creditorName.trim()) {
      toast.error('Creditor name is required');
      return;
    }

    if (!formData.originalAmount || parseFloat(formData.originalAmount) <= 0) {
      toast.error('Original amount must be greater than 0');
      return;
    }

    if (formData.remainingBalance === '' || parseFloat(formData.remainingBalance) < 0) {
      toast.error('Remaining balance is required and must be >= 0');
      return;
    }

    if (!formData.startDate) {
      toast.error('Start date is required');
      return;
    }

    onSubmit({
      ...formData,
      originalAmount: parseFloat(formData.originalAmount),
      remainingBalance: parseFloat(formData.remainingBalance),
      minimumPayment: formData.minimumPayment ? parseFloat(formData.minimumPayment) : undefined,
      interestRate: parseFloat(String(formData.interestRate)),
      // Loan structure fields
      loanTermMonths: formData.loanTermMonths ? parseInt(String(formData.loanTermMonths)) : undefined,
      originationDate: formData.originationDate || undefined,
      // Interest calculation fields
      billingCycleDays: formData.billingCycleDays ? parseInt(String(formData.billingCycleDays)) : 30,
      // Credit card fields
      lastStatementDate: formData.lastStatementDate || undefined,
      lastStatementBalance: formData.lastStatementBalance ? parseFloat(String(formData.lastStatementBalance)) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Required fields notice */}
      <p className="text-sm text-gray-400">
        Fields marked with <span className="text-red-400">*</span> are required
      </p>

      {/* Name and Creditor */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-400 text-sm mb-1">
            Debt Name <span className="text-red-400">*</span>
          </Label>
          <Input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Credit Card Debt"
            className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600"
            required
          />
        </div>
        <div>
          <Label className="text-gray-400 text-sm mb-1">
            Creditor Name <span className="text-red-400">*</span>
          </Label>
          <Input
            name="creditorName"
            value={formData.creditorName}
            onChange={handleChange}
            placeholder="e.g., Capital One"
            className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600"
            required
          />
        </div>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-400 text-sm mb-1">
            Original Amount <span className="text-red-400">*</span>
          </Label>
          <Input
            name="originalAmount"
            type="number"
            value={formData.originalAmount}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            min="0.01"
            className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600"
            required
          />
        </div>
        <div>
          <Label className="text-gray-400 text-sm mb-1">
            Remaining Balance <span className="text-red-400">*</span>
          </Label>
          <Input
            name="remainingBalance"
            type="number"
            value={formData.remainingBalance}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600"
            required
          />
        </div>
      </div>

      {/* Payment Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-400 text-sm mb-1">Minimum Payment (Optional)</Label>
          <Input
            name="minimumPayment"
            type="number"
            value={formData.minimumPayment}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600"
          />
        </div>
        <div>
          <Label className="text-gray-400 text-sm mb-1">Interest Rate (%)</Label>
          <Input
            name="interestRate"
            type="number"
            value={formData.interestRate}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600"
          />
        </div>
      </div>

      {/* Debt Type and Interest Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-400 text-sm mb-1">Debt Type</Label>
          <Select value={formData.type} onValueChange={(v) => handleSelectChange('type', v)}>
            <SelectTrigger className="bg-[#242424] border-[#2a2a2a] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
              {DEBT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-white">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-gray-400 text-sm mb-1">Interest Type</Label>
          <Select
            value={formData.interestType}
            onValueChange={(v) => handleSelectChange('interestType', v)}
          >
            <SelectTrigger className="bg-[#242424] border-[#2a2a2a] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
              {INTEREST_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-white">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loan Type */}
      <div>
        <Label className="text-gray-400 text-sm mb-1">Loan Type</Label>
        <Select value={formData.loanType} onValueChange={(v) => handleSelectChange('loanType', v)}>
          <SelectTrigger className="bg-[#242424] border-[#2a2a2a] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
            {LOAN_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-white">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          {formData.loanType === 'revolving'
            ? 'Revolving credit has variable balances (credit cards, lines of credit)'
            : 'Installment loans have fixed payment schedules (mortgages, car loans, personal loans)'}
        </p>
      </div>

      {/* Installment Loan Fields */}
      {formData.loanType === 'installment' && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
          <div className="col-span-2">
            <p className="text-sm text-blue-400 mb-3">Installment Loan Details</p>
          </div>
          <div>
            <Label className="text-gray-400 text-sm mb-1">Loan Term (months)</Label>
            <Input
              name="loanTermMonths"
              type="number"
              value={formData.loanTermMonths}
              onChange={handleChange}
              placeholder="60 for 5-year loan, 360 for 30-year"
              min="1"
              className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">
              Total loan term: 60 months = 5 years, 360 months = 30 years
            </p>
          </div>
          <div>
            <Label className="text-gray-400 text-sm mb-1">Origination Date</Label>
            <Input
              name="originationDate"
              type="date"
              value={formData.originationDate}
              onChange={handleChange}
              className="bg-[#242424] border-[#2a2a2a] text-white"
            />
            <p className="text-xs text-gray-500 mt-1">When did the loan start?</p>
          </div>
        </div>
      )}

      {/* Revolving Credit Fields */}
      {formData.loanType === 'revolving' && (
        <div className="space-y-4 p-4 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
          <div>
            <p className="text-sm text-blue-400 mb-3">Revolving Credit Details</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400 text-sm mb-1">Compounding Frequency</Label>
              <Select
                value={formData.compoundingFrequency}
                onValueChange={(v) => handleSelectChange('compoundingFrequency', v)}
              >
                <SelectTrigger className="bg-[#242424] border-[#2a2a2a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                  {COMPOUNDING_FREQUENCIES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-white">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">How often does interest compound?</p>
            </div>
            <div>
              <Label className="text-gray-400 text-sm mb-1">Billing Cycle (days)</Label>
              <Input
                name="billingCycleDays"
                type="number"
                value={formData.billingCycleDays}
                onChange={handleChange}
                placeholder="30"
                min="28"
                max="31"
                className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Usually 30 days for credit cards</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400 text-sm mb-1">Last Statement Date</Label>
              <Input
                name="lastStatementDate"
                type="date"
                value={formData.lastStatementDate}
                onChange={handleChange}
                className="bg-[#242424] border-[#2a2a2a] text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Date of last billing statement</p>
            </div>
            <div>
              <Label className="text-gray-400 text-sm mb-1">Last Statement Balance</Label>
              <Input
                name="lastStatementBalance"
                type="number"
                value={formData.lastStatementBalance}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Balance on last statement</p>
            </div>
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-400 text-sm mb-1">
            Start Date <span className="text-red-400">*</span>
          </Label>
          <Input
            name="startDate"
            type="date"
            value={formData.startDate}
            onChange={handleChange}
            className="bg-[#242424] border-[#2a2a2a] text-white"
            required
          />
        </div>
        <div>
          <Label className="text-gray-400 text-sm mb-1">Target Payoff Date (Optional)</Label>
          <Input
            name="targetPayoffDate"
            type="date"
            value={formData.targetPayoffDate}
            onChange={handleChange}
            className="bg-[#242424] border-[#2a2a2a] text-white"
          />
        </div>
      </div>

      {/* Priority */}
      <div>
        <Label className="text-gray-400 text-sm mb-1">Priority (Lower = Higher Priority)</Label>
        <Input
          name="priority"
          type="number"
          value={formData.priority}
          onChange={handleChange}
          placeholder="0"
          className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600"
        />
      </div>

      {/* Color Picker */}
      <div>
        <Label className="text-gray-400 text-sm mb-2">Color</Label>
        <div className="flex gap-2">
          {DEBT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleColorChange(color)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                formData.color === color ? 'border-white scale-110' : 'border-[#2a2a2a]'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <Label className="text-gray-400 text-sm mb-1">Description (Optional)</Label>
        <Textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Additional details about this debt..."
          className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600 min-h-20"
        />
      </div>

      {/* Notes */}
      <div>
        <Label className="text-gray-400 text-sm mb-1">Notes (Optional)</Label>
        <Textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Additional notes..."
          className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600 min-h-20"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isLoading ? 'Saving...' : debt ? 'Update Debt' : 'Create Debt'}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="flex-1 border-[#2a2a2a] text-gray-400 hover:text-white"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
