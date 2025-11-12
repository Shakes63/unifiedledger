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

const CATEGORY_TYPES = [
  { value: 'income', label: 'Income' },
  { value: 'variable_expense', label: 'Variable Expense' },
  { value: 'monthly_bill', label: 'Monthly Bill' },
  { value: 'savings', label: 'Savings' },
  { value: 'debt', label: 'Debt' },
  { value: 'non_monthly_bill', label: 'Non-Monthly Bill' },
];

interface CategoryFormProps {
  category?: any;
  onSubmit: (data: any) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function CategoryForm({
  category,
  onSubmit,
  onCancel,
  isLoading = false,
}: CategoryFormProps) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    type: category?.type || 'variable_expense',
    monthlyBudget: category?.monthlyBudget || 0,
    dueDate: category?.dueDate || '',
    isTaxDeductible: category?.isTaxDeductible || false,
    isActive: category?.isActive !== undefined ? category.isActive : true,
    incomeFrequency: category?.incomeFrequency || 'variable',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'monthlyBudget' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
      toast.error('Category name is required');
      return;
    }

    if (!formData.type) {
      toast.error('Category type is required');
      return;
    }

    const submitData = {
      name: formData.name,
      type: formData.type,
      monthlyBudget: parseFloat(String(formData.monthlyBudget)) || 0,
      dueDate: formData.dueDate ? parseInt(formData.dueDate) : null,
      isTaxDeductible: formData.isTaxDeductible,
      isActive: formData.isActive,
      incomeFrequency: formData.type === 'income' ? formData.incomeFrequency : undefined,
    };

    onSubmit(submitData);
  };

  const isBillType = formData.type === 'monthly_bill' || formData.type === 'non_monthly_bill';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name and Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Category Name</Label>
          <Input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Groceries"
            className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Category Type</Label>
          <Select value={formData.type} onValueChange={(value) => handleSelectChange('type', value)}>
            <SelectTrigger className="bg-elevated border-border text-foreground">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Monthly Budget */}
      <div>
        <Label className="text-muted-foreground text-sm mb-2 block">Monthly Budget (Optional)</Label>
        <Input
          name="monthlyBudget"
          type="number"
          value={formData.monthlyBudget}
          onChange={handleChange}
          placeholder="0.00"
          step="0.01"
          min="0"
          className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground mt-1">Set to 0 for no budget limit</p>
      </div>

      {/* Income Frequency (for income categories) */}
      {formData.type === 'income' && (
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Income Frequency</Label>
          <Select
            value={formData.incomeFrequency}
            onValueChange={(value) => handleSelectChange('incomeFrequency', value)}
          >
            <SelectTrigger className="bg-elevated border-border text-foreground">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly (52 times/year)</SelectItem>
              <SelectItem value="biweekly">Biweekly (26 times/year)</SelectItem>
              <SelectItem value="monthly">Monthly (12 times/year)</SelectItem>
              <SelectItem value="variable">Variable (use daily average)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            How often do you receive this income? This helps budget tracking provide accurate projections.
          </p>
        </div>
      )}

      {/* Due Date (for bill categories) */}
      {isBillType && (
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Due Date (Optional)</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Day</span>
            <Input
              name="dueDate"
              type="number"
              value={formData.dueDate}
              onChange={handleChange}
              placeholder="1-31"
              min="1"
              max="31"
              className="bg-elevated border-border text-foreground placeholder:text-muted-foreground w-20"
            />
            <span className="text-muted-foreground text-sm">of month</span>
          </div>
        </div>
      )}

      {/* Toggles */}
      <div className="p-4 bg-card rounded-lg border border-border space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-muted-foreground text-sm block font-medium">Active</Label>
            <p className="text-xs text-muted-foreground mt-1">Enable or disable this category</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('isActive')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.isActive ? 'bg-[var(--color-income)]' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-card)] transition-transform ${
                formData.isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <Label className="text-muted-foreground text-sm block font-medium">Tax Deductible</Label>
            <p className="text-xs text-muted-foreground mt-1">Mark this category as tax deductible for tracking deductible expenses</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('isTaxDeductible')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.isTaxDeductible ? 'bg-[var(--color-income)]' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-card)] transition-transform ${
                formData.isTaxDeductible ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-border">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 font-medium"
        >
          {isLoading ? 'Saving...' : category ? 'Update Category' : 'Create Category'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            className="flex-1 bg-elevated border-border text-foreground hover:bg-border"
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
