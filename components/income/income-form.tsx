'use client';

import { useState, useEffect } from 'react';
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
import { parseISO } from 'date-fns';
import {
  FREQUENCY_LABELS,
  DAY_OF_WEEK_OPTIONS,
  MONTH_OPTIONS,
  isWeekBasedFrequency,
  isOneTimeFrequency,
  isNonMonthlyPeriodic,
  getDueDateLabel,
} from '@/lib/bills/bill-utils';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

// Income classification options
const INCOME_CLASSIFICATION_OPTIONS = [
  { value: 'salary', label: 'Salary/Wages' },
  { value: 'rental', label: 'Rental Income' },
  { value: 'investment', label: 'Investment/Dividends' },
  { value: 'freelance', label: 'Freelance/Contract' },
  { value: 'benefits', label: 'Government Benefits' },
  { value: 'refund', label: 'Refunds/Reimbursements' },
  { value: 'other', label: 'Other' },
] as const;

// Income data structure
export interface IncomeData {
  id?: string;
  name: string;
  expectedAmount: number | string;
  dueDate?: number | null;
  specificDueDate?: string | null;
  startMonth?: number | null;
  frequency: string;
  isVariableAmount?: boolean;
  categoryId?: string | null;
  accountId?: string | null;
  autoMarkPaid?: boolean;
  notes?: string | null;
  billType: 'income';
  billClassification?: string;
}

interface Account {
  id: string;
  name: string;
  type?: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface IncomeFormProps {
  income?: IncomeData;
  onSubmit: (data: IncomeData, saveMode?: 'save' | 'saveAndAdd') => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function IncomeForm({
  income,
  onSubmit,
  onCancel,
  isLoading = false,
}: IncomeFormProps) {
  const [saveMode, setSaveMode] = useState<'save' | 'saveAndAdd' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: income?.name || '',
    expectedAmount: income?.expectedAmount || '',
    dueDate: income?.dueDate !== undefined ? String(income.dueDate) : '1',
    specificDueDate: income?.specificDueDate || '',
    startMonth: income?.startMonth !== undefined && income?.startMonth !== null 
      ? String(income.startMonth) 
      : String(new Date().getMonth()),
    frequency: income?.frequency || 'monthly',
    isVariableAmount: income?.isVariableAmount || false,
    categoryId: income?.categoryId || '',
    accountId: income?.accountId || '',
    autoMarkPaid: income?.autoMarkPaid !== undefined ? income.autoMarkPaid : true,
    notes: income?.notes || '',
    billClassification: income?.billClassification || 'salary',
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();

  // Fetch categories and accounts on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedHouseholdId) return;

      try {
        const [categoriesRes, accountsRes] = await Promise.all([
          fetchWithHousehold('/api/categories'),
          fetchWithHousehold('/api/accounts'),
        ]);

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        }

        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          setAccounts(Array.isArray(accountsData) ? accountsData : []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [selectedHouseholdId, fetchWithHousehold]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'expectedAmount'
          ? parseFloat(value) || ''
          : name === 'dueDate'
            ? value
            : value,
    }));
  };

  const handleCheckboxChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: !prev[name as keyof typeof prev],
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Income source name is required';
    }

    if (!formData.expectedAmount || parseFloat(String(formData.expectedAmount)) <= 0) {
      newErrors.expectedAmount = 'Expected amount must be greater than 0';
    }

    // Frequency-specific validation
    if (isOneTimeFrequency(formData.frequency)) {
      if (!formData.specificDueDate) {
        newErrors.specificDueDate = 'Date is required for one-time income';
      } else {
        const selectedDate = parseISO(formData.specificDueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          newErrors.specificDueDate = 'Date cannot be in the past';
        }
      }
    } else if (isWeekBasedFrequency(formData.frequency)) {
      const dayOfWeek = parseInt(formData.dueDate);
      if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        newErrors.dueDate = 'Day of week must be between 0-6';
      }
    } else {
      const dueDate = parseInt(formData.dueDate);
      if (isNaN(dueDate) || dueDate < 1 || dueDate > 31) {
        newErrors.dueDate = 'Day must be between 1 and 31';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSaveMode(null);
      toast.error(Object.values(newErrors)[0]);
      return;
    }

    setErrors({});

    onSubmit({
      name: formData.name,
      expectedAmount: parseFloat(String(formData.expectedAmount)),
      dueDate: isOneTimeFrequency(formData.frequency) ? null : parseInt(formData.dueDate),
      specificDueDate: isOneTimeFrequency(formData.frequency) ? formData.specificDueDate : null,
      startMonth: isNonMonthlyPeriodic(formData.frequency) ? parseInt(formData.startMonth) : null,
      frequency: formData.frequency,
      isVariableAmount: formData.isVariableAmount,
      categoryId: formData.categoryId || null,
      accountId: formData.accountId || null,
      autoMarkPaid: formData.autoMarkPaid,
      notes: formData.notes || null,
      billType: 'income',
      billClassification: formData.billClassification,
    }, saveMode || 'save');

    // If save & add another, reset form
    if (saveMode === 'saveAndAdd') {
      const preservedFrequency = formData.frequency;
      setFormData({
        name: '',
        expectedAmount: '',
        dueDate: '1',
        specificDueDate: '',
        startMonth: String(new Date().getMonth()),
        frequency: preservedFrequency,
        isVariableAmount: false,
        categoryId: '',
        accountId: '',
        autoMarkPaid: true,
        notes: '',
        billClassification: 'salary',
      });
      setSaveMode(null);

      setTimeout(() => {
        document.getElementById('income-name')?.focus();
      }, 100);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name and Amount */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className={`text-sm mb-2 block ${errors.name ? 'text-error' : 'text-muted-foreground'}`}>
            Income Source Name*
          </Label>
          <Input
            id="income-name"
            name="name"
            value={formData.name}
            onChange={(e) => {
              handleChange(e);
              if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
            }}
            placeholder="e.g., Monthly Salary, Rental Income"
            className={`bg-elevated text-foreground placeholder:text-muted-foreground/50 placeholder:italic ${
              errors.name ? 'border-error' : 'border-border'
            }`}
          />
          {errors.name && (
            <p className="text-error text-xs mt-1">{errors.name}</p>
          )}
        </div>
        <div>
          <Label className={`text-sm mb-2 block ${errors.expectedAmount ? 'text-error' : 'text-muted-foreground'}`}>
            Expected Amount*
          </Label>
          <Input
            name="expectedAmount"
            type="number"
            value={formData.expectedAmount}
            onChange={(e) => {
              handleChange(e);
              if (errors.expectedAmount) setErrors(prev => ({ ...prev, expectedAmount: '' }));
            }}
            placeholder="Enter amount"
            step="0.01"
            className={`bg-elevated text-foreground placeholder:text-muted-foreground/50 placeholder:italic ${
              errors.expectedAmount ? 'border-error' : 'border-border'
            }`}
          />
          {errors.expectedAmount && (
            <p className="text-error text-xs mt-1">{errors.expectedAmount}</p>
          )}
        </div>
      </div>

      {/* Frequency and Expected Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Frequency*</Label>
          <Select value={formData.frequency} onValueChange={(value) => handleSelectChange('frequency', value)}>
            <SelectTrigger className="bg-elevated border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="one-time" className="text-foreground">{FREQUENCY_LABELS['one-time']}</SelectItem>
              <SelectItem value="weekly" className="text-foreground">{FREQUENCY_LABELS['weekly']}</SelectItem>
              <SelectItem value="biweekly" className="text-foreground">{FREQUENCY_LABELS['biweekly']}</SelectItem>
              <SelectItem value="monthly" className="text-foreground">{FREQUENCY_LABELS['monthly']}</SelectItem>
              <SelectItem value="quarterly" className="text-foreground">{FREQUENCY_LABELS['quarterly']}</SelectItem>
              <SelectItem value="semi-annual" className="text-foreground">{FREQUENCY_LABELS['semi-annual']}</SelectItem>
              <SelectItem value="annual" className="text-foreground">{FREQUENCY_LABELS['annual']}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">
            {getDueDateLabel(formData.frequency).replace('Due', 'Expected')}*
          </Label>

          {isOneTimeFrequency(formData.frequency) ? (
            <Input
              name="specificDueDate"
              type="date"
              value={formData.specificDueDate}
              onChange={handleChange}
              className="bg-elevated border-border text-foreground"
              required
            />
          ) : isWeekBasedFrequency(formData.frequency) ? (
            <Select
              value={formData.dueDate}
              onValueChange={(value) => handleSelectChange('dueDate', value)}
            >
              <SelectTrigger className="bg-elevated border-border text-foreground">
                <SelectValue placeholder="Select day of week" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {DAY_OF_WEEK_OPTIONS.map((day) => (
                  <SelectItem key={day.value} value={day.value.toString()} className="text-foreground">
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              name="dueDate"
              type="number"
              value={formData.dueDate}
              onChange={handleChange}
              placeholder="1"
              min="1"
              max="31"
              className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
            />
          )}
        </div>
      </div>

      {/* Start Month - Only for quarterly/semi-annual/annual */}
      {isNonMonthlyPeriodic(formData.frequency) && (
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Start Month*</Label>
          <Select
            value={formData.startMonth}
            onValueChange={(value) => handleSelectChange('startMonth', value)}
          >
            <SelectTrigger className="bg-elevated border-border text-foreground">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {MONTH_OPTIONS.map((month) => (
                <SelectItem 
                  key={month.value} 
                  value={month.value.toString()} 
                  className="text-foreground"
                >
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Classification and Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Income Type</Label>
          <Select
            value={formData.billClassification}
            onValueChange={(value) => handleSelectChange('billClassification', value)}
          >
            <SelectTrigger className="bg-elevated border-border text-foreground">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {INCOME_CLASSIFICATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-foreground">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Category</Label>
          <Select value={formData.categoryId} onValueChange={(value) => handleSelectChange('categoryId', value)}>
            <SelectTrigger className="bg-elevated border-border text-foreground">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Account */}
      <div>
        <Label className="text-muted-foreground text-sm mb-2 block">Receiving Account</Label>
        <Select value={formData.accountId} onValueChange={(value) => handleSelectChange('accountId', value)}>
          <SelectTrigger className="bg-elevated border-border text-foreground">
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">The account where you receive this income</p>
      </div>

      {/* Toggles */}
      <div className="space-y-3 p-4 bg-card rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-muted-foreground text-sm block">Variable Amount</Label>
            <p className="text-xs text-muted-foreground">Amount varies each time</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('isVariableAmount')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.isVariableAmount ? 'bg-income' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                formData.isVariableAmount ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <Label className="text-muted-foreground text-sm block">Auto-mark Received</Label>
            <p className="text-xs text-muted-foreground">Mark as received when matching transaction is created</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('autoMarkPaid')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.autoMarkPaid ? 'bg-income' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                formData.autoMarkPaid ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label className="text-muted-foreground text-sm mb-2 block">Notes</Label>
        <Textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Add any additional notes..."
          className="bg-elevated border-border text-foreground placeholder:text-muted-foreground resize-none"
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-4 border-t border-border">
        <div className="flex gap-2">
          <Button
            type="submit"
            onClick={() => setSaveMode('save')}
            disabled={isLoading}
            className="flex-1 text-white hover:opacity-90 font-medium bg-income"
          >
            {income
              ? isLoading && saveMode === 'save'
                ? 'Updating...'
                : 'Update Income'
              : isLoading && saveMode === 'save'
              ? 'Saving...'
              : 'Save Income'}
          </Button>
          {!income && (
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
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="w-full bg-elevated border-border text-foreground hover:bg-elevated"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

