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
import { Wallet, DollarSign, CreditCard, TrendingUp, Coins, Building2, PiggyBank, Briefcase } from 'lucide-react';
import type { AccountFormData, AccountType } from '@/lib/types';

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking', icon: Wallet },
  { value: 'savings', label: 'Savings', icon: TrendingUp },
  { value: 'credit', label: 'Credit Card', icon: CreditCard },
  { value: 'investment', label: 'Investment', icon: DollarSign },
  { value: 'cash', label: 'Cash', icon: Coins },
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
  });

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
          <Label className="text-muted-foreground text-sm mb-2 block">Current Balance</Label>
          <Input
            name="currentBalance"
            type="number"
            value={formData.currentBalance}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        {formData.type === 'credit' && (
          <div>
            <Label className="text-muted-foreground text-sm mb-2 block">Credit Limit (Optional)</Label>
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
