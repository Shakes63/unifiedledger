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

type CategoryType = CategoryFormData['type'];

const CATEGORY_TYPES = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'savings', label: 'Savings' },
];

interface ParentCategory {
  id: string;
  name: string;
  type: string;
}

interface CategoryFormProps {
  category?: Partial<CategoryFormData> | null;
  onSubmit: (data: Partial<CategoryFormData>) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  defaultBusinessCategory?: boolean;
  isParentCategory?: boolean;
  parentCategories?: ParentCategory[];
}

export function CategoryForm({
  category,
  onSubmit,
  onCancel,
  isLoading = false,
  defaultBusinessCategory = false,
  isParentCategory = false,
  parentCategories = [],
}: CategoryFormProps) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    type: category?.type || 'expense',
    monthlyBudget: category?.monthlyBudget || 0,
    isTaxDeductible: category?.isTaxDeductible || false,
    isBusinessCategory: category?.isBusinessCategory ?? defaultBusinessCategory,
    isActive: category?.isActive !== undefined ? category.isActive : true,
    incomeFrequency: category?.incomeFrequency || 'variable',
    parentId: category?.parentId || '',
    targetAllocation: category?.targetAllocation || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filter parent categories by selected type
  const availableParents = parentCategories.filter(p => p.type === formData.type);

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

    const submitData: Record<string, unknown> = {
      name: formData.name,
      type: formData.type,
      isTaxDeductible: formData.isTaxDeductible,
      isBusinessCategory: formData.isBusinessCategory,
      isActive: formData.isActive,
    };

    if (isParentCategory) {
      // Parent category - no budget, but has targetAllocation
      submitData.isBudgetGroup = true;
      submitData.monthlyBudget = 0;
      submitData.targetAllocation = formData.targetAllocation ? parseFloat(String(formData.targetAllocation)) : null;
    } else {
      // Regular category
      submitData.monthlyBudget = parseFloat(String(formData.monthlyBudget)) || 0;
      submitData.parentId = formData.parentId || null;
      if (formData.type === 'income') {
        submitData.incomeFrequency = formData.incomeFrequency;
      }
    }

    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name and Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm mb-2 block" style={{ color: errors.name ? 'var(--color-destructive)' : 'var(--color-muted-foreground)' }}>
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
            className="placeholder:italic"
            style={{
              backgroundColor: 'var(--color-elevated)',
              color: 'var(--color-foreground)',
              border: errors.name ? '1px solid var(--color-destructive)' : '1px solid var(--color-border)',
            }}
          />
          {errors.name && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-destructive)' }}>{errors.name}</p>
          )}
        </div>
        <div>
          <Label className="text-sm mb-2 block" style={{ color: errors.type ? 'var(--color-destructive)' : 'var(--color-muted-foreground)' }}>
            Category Type
          </Label>
          <Select 
            value={formData.type} 
            onValueChange={(value) => {
              setFormData(prev => ({
                ...prev,
                type: value as CategoryType,
                ...(isParentCategory ? {} : { parentId: '' }),
              }));
              if (errors.type) setErrors(prev => ({ ...prev, type: '' }));
            }}
          >
            <SelectTrigger
              className=""
              style={{
                backgroundColor: 'var(--color-elevated)',
                color: 'var(--color-foreground)',
                border: errors.type ? '1px solid var(--color-destructive)' : '1px solid var(--color-border)',
              }}>
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
            <p className="text-xs mt-1" style={{ color: 'var(--color-destructive)' }}>{errors.type}</p>
          )}
        </div>
      </div>

      {/* Parent Category Selector (for regular categories) */}
      {!isParentCategory && availableParents.length > 0 && (
        <div>
          <Label className="text-sm mb-2 block" style={{ color: 'var(--color-muted-foreground)' }}>Parent Category (Optional)</Label>
          <Select
            value={formData.parentId}
            onValueChange={(value) => handleSelectChange('parentId', value)}
          >
            <SelectTrigger className="" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
              <SelectValue placeholder="Select parent category (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No parent (standalone category)</SelectItem>
              {availableParents.map((parent) => (
                <SelectItem key={parent.id} value={parent.id}>
                  {parent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
            Optionally group this category under a parent for 50/30/20 or similar budgeting
          </p>
        </div>
      )}

      {/* Target Allocation (for parent categories) */}
      {isParentCategory && (
        <div>
          <Label className="text-sm mb-2 block" style={{ color: 'var(--color-muted-foreground)' }}>Target Allocation % (Optional)</Label>
          <Input
            name="targetAllocation"
            type="number"
            value={formData.targetAllocation}
            onChange={handleChange}
            placeholder="e.g., 50 for 50%"
            step="1"
            min="0"
            max="100"
            className="placeholder:italic"
            style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
            What percentage of income should go to this category group? (e.g., 50% for Needs in 50/30/20)
          </p>
        </div>
      )}

      {/* Monthly Budget (for regular categories only) */}
      {!isParentCategory && (
        <div>
          <Label className="text-sm mb-2 block" style={{ color: 'var(--color-muted-foreground)' }}>Monthly Budget (Optional)</Label>
          <Input
            name="monthlyBudget"
            type="number"
            value={formData.monthlyBudget}
            onChange={handleChange}
            placeholder="Enter budget"
            step="0.01"
            min="0"
            className="placeholder:italic"
            style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Set to 0 for no budget limit</p>
        </div>
      )}

      {/* Income Frequency (for income categories) */}
      {!isParentCategory && formData.type === 'income' && (
        <div>
          <Label className="text-sm mb-2 block" style={{ color: 'var(--color-muted-foreground)' }}>Income Frequency</Label>
          <Select
            value={formData.incomeFrequency}
            onValueChange={(value) => handleSelectChange('incomeFrequency', value)}
          >
            <SelectTrigger className="" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly (52 times/year)</SelectItem>
              <SelectItem value="biweekly">Biweekly (26 times/year)</SelectItem>
              <SelectItem value="monthly">Monthly (12 times/year)</SelectItem>
              <SelectItem value="variable">Variable (use daily average)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
            How often do you receive this income? This helps budget tracking provide accurate projections.
          </p>
        </div>
      )}

      {/* Toggles */}
      <div className="p-4 rounded-lg border space-y-3" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm block font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Active</Label>
            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Enable or disable this category</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('isActive')}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            style={{ backgroundColor: formData.isActive ? 'var(--color-income)' : 'var(--color-border)' }}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                formData.isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
              style={{ backgroundColor: 'var(--color-background)' }}
            />
          </button>
        </div>
        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <Label className="text-sm block font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Tax Deductible</Label>
            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Mark this category as tax deductible for tracking deductible expenses</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('isTaxDeductible')}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            style={{ backgroundColor: formData.isTaxDeductible ? 'var(--color-income)' : 'var(--color-border)' }}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                formData.isTaxDeductible ? 'translate-x-6' : 'translate-x-1'
              }`}
              style={{ backgroundColor: 'var(--color-background)' }}
            />
          </button>
        </div>
        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <Label className="text-sm block font-medium" style={{ color: 'var(--color-muted-foreground)' }}>Business Category</Label>
            <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Mark as a business category to group it separately in transaction forms</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('isBusinessCategory')}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            style={{ backgroundColor: formData.isBusinessCategory ? 'var(--color-income)' : 'var(--color-border)' }}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                formData.isBusinessCategory ? 'translate-x-6' : 'translate-x-1'
              }`}
              style={{ backgroundColor: 'var(--color-background)' }}
            />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 font-medium"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
        >
          {isLoading ? 'Saving...' : category ? 'Update Category' : 'Create Category'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            className="flex-1"
            style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
