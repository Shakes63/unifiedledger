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
import type { CategoryFormData } from '@/lib/types';

const CATEGORY_TYPES = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'savings', label: 'Savings' },
];

interface CategoryFormProps {
  category?: Partial<CategoryFormData> | null;
  onSubmit: (data: Partial<CategoryFormData>) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  defaultBusinessCategory?: boolean;
}

export function CategoryForm({
  category,
  onSubmit,
  onCancel,
  isLoading = false,
  defaultBusinessCategory = false,
}: CategoryFormProps) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    type: category?.type || 'expense',
    monthlyBudget: category?.monthlyBudget || 0,
    isTaxDeductible: category?.isTaxDeductible || false,
    isBusinessCategory: category?.isBusinessCategory ?? defaultBusinessCategory,
    isActive: category?.isActive !== undefined ? category.isActive : true,
    incomeFrequency: category?.incomeFrequency || 'variable',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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

    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Category name is required';
    }

    if (!formData.type) {
      newErrors.type = 'Category type is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error(Object.values(newErrors)[0]);
      return;
    }

    setErrors({});

    const submitData = {
      name: formData.name,
      type: formData.type,
      monthlyBudget: parseFloat(String(formData.monthlyBudget)) || 0,
      isTaxDeductible: formData.isTaxDeductible,
      isBusinessCategory: formData.isBusinessCategory,
      isActive: formData.isActive,
      incomeFrequency: formData.type === 'income' ? formData.incomeFrequency : undefined,
    };

    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name and Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className={`text-sm mb-2 block ${errors.name ? 'text-[var(--color-error)]' : 'text-muted-foreground'}`}>
            Category Name
          </Label>
          <Input
            name="name"
            value={formData.name}
            onChange={(e) => {
              handleChange(e);
              if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
            }}
            placeholder="e.g., Groceries"
            className={`bg-elevated text-foreground placeholder:text-muted-foreground/50 placeholder:italic ${
              errors.name ? 'border-[var(--color-error)]' : 'border-border'
            }`}
          />
          {errors.name && (
            <p className="text-[var(--color-error)] text-xs mt-1">{errors.name}</p>
          )}
        </div>
        <div>
          <Label className={`text-sm mb-2 block ${errors.type ? 'text-[var(--color-error)]' : 'text-muted-foreground'}`}>
            Category Type
          </Label>
          <Select 
            value={formData.type} 
            onValueChange={(value) => {
              handleSelectChange('type', value);
              if (errors.type) setErrors(prev => ({ ...prev, type: '' }));
            }}
          >
            <SelectTrigger className={`bg-elevated text-foreground ${
              errors.type ? 'border-[var(--color-error)]' : 'border-border'
            }`}>
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
          {errors.type && (
            <p className="text-[var(--color-error)] text-xs mt-1">{errors.type}</p>
          )}
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
          placeholder="Enter budget"
          step="0.01"
          min="0"
          className="bg-elevated border-border text-foreground placeholder:text-muted-foreground/50 placeholder:italic"
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
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <Label className="text-muted-foreground text-sm block font-medium">Business Category</Label>
            <p className="text-xs text-muted-foreground mt-1">Mark as a business category to group it separately in transaction forms</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('isBusinessCategory')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.isBusinessCategory ? 'bg-[var(--color-income)]' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-card)] transition-transform ${
                formData.isBusinessCategory ? 'translate-x-6' : 'translate-x-1'
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
