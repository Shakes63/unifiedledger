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
import { Wallet, DollarSign, CreditCard, TrendingUp, Coins } from 'lucide-react';

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
  'wallet',
  'bank',
  'credit-card',
  'piggy-bank',
  'trending-up',
  'dollar-sign',
  'coins',
  'briefcase',
];

interface AccountFormProps {
  account?: any;
  onSubmit: (data: any) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function AccountForm({
  account,
  onSubmit,
  onCancel,
  isLoading = false,
}: AccountFormProps) {
  const [formData, setFormData] = useState({
    name: account?.name || '',
    type: account?.type || 'checking',
    bankName: account?.bankName || '',
    accountNumberLast4: account?.accountNumberLast4 || '',
    currentBalance: account?.currentBalance || 0,
    creditLimit: account?.creditLimit || '',
    color: account?.color || '#3b82f6',
    icon: account?.icon || 'wallet',
    isBusinessAccount: account?.isBusinessAccount || false,
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
      return;
    }

    if (!formData.type) {
      toast.error('Account type is required');
      return;
    }

    const submitData = {
      name: formData.name,
      type: formData.type,
      bankName: formData.bankName || null,
      accountNumberLast4: formData.accountNumberLast4 || null,
      currentBalance: parseFloat(String(formData.currentBalance)) || 0,
      creditLimit: formData.creditLimit ? parseFloat(String(formData.creditLimit)) : null,
      color: formData.color,
      icon: formData.icon,
      isBusinessAccount: formData.isBusinessAccount,
    };

    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name and Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Account Name</Label>
          <Input
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

      {/* Business Account Toggle */}
      <div className="p-4 bg-card rounded-lg border border-border space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-muted-foreground text-sm block font-medium">Business Account</Label>
            <p className="text-xs text-muted-foreground mt-1">Enable sales tax tracking for this account</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('isBusinessAccount')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.isBusinessAccount ? 'bg-[var(--color-income)]' : 'bg-elevated'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-card)] transition-transform ${
                formData.isBusinessAccount ? 'translate-x-6' : 'translate-x-1'
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
                formData.color === color ? 'border-[var(--color-card)]' : 'border-transparent'
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
          {ACCOUNT_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => handleIconChange(icon)}
              className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                formData.icon === icon
                  ? 'border-[var(--color-income)] bg-[var(--color-income)]/10 text-[var(--color-income)]'
                  : 'border-border bg-elevated text-muted-foreground hover:border-border'
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-border">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 font-medium"
        >
          {isLoading ? 'Creating...' : account ? 'Update Account' : 'Create Account'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            className="flex-1 bg-elevated border-border text-foreground hover:bg-elevated"
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
