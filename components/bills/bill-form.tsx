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
import { AlertCircle, Plus, X } from 'lucide-react';
import {
  FREQUENCY_LABELS,
  DAY_OF_WEEK_OPTIONS,
  isWeekBasedFrequency,
  isOneTimeFrequency,
  getDueDateLabel,
} from '@/lib/bills/bill-utils';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface BillFormProps {
  bill?: any;
  onSubmit: (data: any, saveMode?: 'save' | 'saveAndAdd') => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function BillForm({
  bill,
  onSubmit,
  onCancel,
  isLoading = false,
}: BillFormProps) {
  const [saveMode, setSaveMode] = useState<'save' | 'saveAndAdd' | null>(null);
  const [formData, setFormData] = useState({
    name: bill?.name || '',
    expectedAmount: bill?.expectedAmount || '',
    dueDate: bill?.dueDate !== undefined ? String(bill.dueDate) : '1',
    specificDueDate: bill?.specificDueDate || '',
    frequency: bill?.frequency || 'monthly',
    isVariableAmount: bill?.isVariableAmount || false,
    amountTolerance: bill?.amountTolerance || 5.0,
    categoryId: bill?.categoryId || '',
    debtId: bill?.debtId || '',
    accountId: bill?.accountId || '',
    autoMarkPaid: bill?.autoMarkPaid !== undefined ? bill.autoMarkPaid : true,
    payeePatterns: bill?.payeePatterns ? JSON.parse(bill.payeePatterns) : [],
    notes: bill?.notes || '',
  });

  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [newPayeePattern, setNewPayeePattern] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();

  // Fetch categories, accounts, and debts on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedHouseholdId) return;

      try {
        const [categoriesRes, accountsRes, debtsRes] = await Promise.all([
          fetchWithHousehold('/api/categories'),
          fetchWithHousehold('/api/accounts'),
          fetchWithHousehold('/api/debts?status=active'),
        ]);

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          // API returns array directly, not wrapped in { data: [] }
          setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        }

        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          // API returns array directly, not wrapped in { data: [] }
          setAccounts(Array.isArray(accountsData) ? accountsData : []);
        }

        if (debtsRes.ok) {
          const debtsData = await debtsRes.json();
          setDebts(Array.isArray(debtsData) ? debtsData : []);
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
        name === 'expectedAmount' || name === 'amountTolerance'
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

  const handleAddPayeePattern = () => {
    if (newPayeePattern.trim()) {
      setFormData((prev) => ({
        ...prev,
        payeePatterns: [...prev.payeePatterns, newPayeePattern.trim()],
      }));
      setNewPayeePattern('');
    }
  };

  const handleRemovePayeePattern = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      payeePatterns: prev.payeePatterns.filter((_: string, i: number) => i !== index),
    }));
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setCreatingCategory(true);
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName,
          type: 'monthly_bill',
          monthlyBudget: 0,
        }),
      });

      if (response.ok) {
        const newCategory = await response.json();
        // Add to categories list
        setCategories([...categories, newCategory]);
        // Auto-select the new category
        handleSelectChange('categoryId', newCategory.id);
        // Reset creation UI
        setNewCategoryName('');
        setIsCreatingCategory(false);
        toast.success(`Category "${newCategory.name}" created!`);
      } else {
        toast.error('Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Error creating category');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleCategoryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateCategory();
    } else if (e.key === 'Escape') {
      setIsCreatingCategory(false);
      setNewCategoryName('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Bill name is required');
      setSaveMode(null);
      return;
    }

    if (!formData.expectedAmount || parseFloat(String(formData.expectedAmount)) <= 0) {
      toast.error('Expected amount must be greater than 0');
      setSaveMode(null);
      return;
    }

    // Frequency-specific validation
    if (isOneTimeFrequency(formData.frequency)) {
      if (!formData.specificDueDate) {
        toast.error('Specific due date is required for one-time bills');
        setSaveMode(null);
        return;
      }
      // Validate date is not in the past
      const selectedDate = new Date(formData.specificDueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        toast.error('Due date cannot be in the past');
        setSaveMode(null);
        return;
      }
    } else if (isWeekBasedFrequency(formData.frequency)) {
      const dayOfWeek = parseInt(formData.dueDate);
      if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        toast.error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
        setSaveMode(null);
        return;
      }
    } else {
      const dueDate = parseInt(formData.dueDate);
      if (isNaN(dueDate) || dueDate < 1 || dueDate > 31) {
        toast.error('Due date must be between 1 and 31');
        setSaveMode(null);
        return;
      }
    }

    onSubmit({
      name: formData.name,
      expectedAmount: parseFloat(String(formData.expectedAmount)),
      dueDate: isOneTimeFrequency(formData.frequency) ? null : parseInt(formData.dueDate),
      specificDueDate: isOneTimeFrequency(formData.frequency) ? formData.specificDueDate : null,
      frequency: formData.frequency,
      isVariableAmount: formData.isVariableAmount,
      amountTolerance: parseFloat(String(formData.amountTolerance)) || 5.0,
      categoryId: formData.categoryId || null,
      debtId: formData.debtId || null,
      accountId: formData.accountId || null,
      autoMarkPaid: formData.autoMarkPaid,
      payeePatterns: formData.payeePatterns.length > 0 ? formData.payeePatterns : null,
      notes: formData.notes || null,
    }, saveMode || 'save');

    // If save & add another, reset form
    if (saveMode === 'saveAndAdd') {
      const preservedFrequency = formData.frequency;
      setFormData({
        name: '',
        expectedAmount: '',
        dueDate: '1',
        specificDueDate: '',
        frequency: preservedFrequency,
        isVariableAmount: false,
        amountTolerance: 5.0,
        categoryId: '',
        debtId: '',
        accountId: '',
        autoMarkPaid: true,
        payeePatterns: [],
        notes: '',
      });
      setNewPayeePattern('');
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setSaveMode(null);

      // Focus on name field for quick data entry
      setTimeout(() => {
        document.getElementById('bill-name')?.focus();
      }, 100);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name and Amount */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Bill Name*</Label>
          <Input
            id="bill-name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Electric Bill"
            className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Expected Amount*</Label>
          <Input
            name="expectedAmount"
            type="number"
            value={formData.expectedAmount}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Frequency and Due Date */}
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
          <Label className="text-muted-foreground text-sm mb-2 block">{getDueDateLabel(formData.frequency)}*</Label>

          {isOneTimeFrequency(formData.frequency) ? (
            // Date picker for one-time bills
            <>
              <Input
                name="specificDueDate"
                type="date"
                value={formData.specificDueDate}
                onChange={handleChange}
                className="bg-elevated border-border text-foreground"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Select the specific date for this bill</p>
            </>
          ) : isWeekBasedFrequency(formData.frequency) ? (
            // Day of week selector for weekly/biweekly
            <>
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
              <p className="text-xs text-muted-foreground mt-1">Day of week for recurring bill</p>
            </>
          ) : (
            // Day of month input for monthly bills
            <>
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
              <p className="text-xs text-muted-foreground mt-1">Day of month (1-31)</p>
            </>
          )}
        </div>
      </div>

      {/* Amount Tolerance */}
      <div>
        <Label className="text-muted-foreground text-sm mb-2 block">Amount Tolerance (%)</Label>
        <Input
          name="amountTolerance"
          type="number"
          value={formData.amountTolerance}
          onChange={handleChange}
          placeholder="5.0"
          step="0.1"
          className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground mt-1">For auto-matching (default 5%)</p>
      </div>

      {/* Category and Account */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Category (Optional)</Label>
          {!isCreatingCategory ? (
            <div className="flex gap-2">
              <Select value={formData.categoryId} onValueChange={(value) => handleSelectChange('categoryId', value)}>
                <SelectTrigger className="flex-1 bg-elevated border-border text-foreground">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsCreatingCategory(true)}
                className="bg-elevated border-border text-muted-foreground hover:bg-elevated"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                autoFocus
                type="text"
                placeholder="New category name..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={handleCategoryKeyDown}
                className="flex-1 bg-card border border-[var(--color-primary)] text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <Button
                type="button"
                size="icon"
                onClick={handleCreateCategory}
                disabled={creatingCategory || !newCategoryName.trim()}
                className="bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setIsCreatingCategory(false);
                  setNewCategoryName('');
                }}
                className="bg-elevated border-border text-muted-foreground hover:bg-elevated"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">Account (Optional)</Label>
          <Select value={formData.accountId} onValueChange={(value) => handleSelectChange('accountId', value)}>
            <SelectTrigger className="bg-elevated border-border text-foreground">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Link to Debt */}
      <div>
        <Label className="text-muted-foreground text-sm mb-2 block">Link to Debt (Optional)</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Link this bill to a debt to automatically track payments and reduce debt balance
        </p>
        <Select value={formData.debtId || 'none'} onValueChange={(value) => handleSelectChange('debtId', value === 'none' ? '' : value)}>
          <SelectTrigger className="bg-elevated border-border text-foreground">
            <SelectValue placeholder="Select debt (optional)" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="none" className="text-foreground">None</SelectItem>
            {debts.map((debt) => (
              <SelectItem key={debt.id} value={debt.id} className="text-foreground">
                {debt.name} - ${debt.remainingBalance?.toFixed(2)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Toggles */}
      <div className="space-y-3 p-4 bg-card rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-muted-foreground text-sm block">Variable Amount</Label>
            <p className="text-xs text-muted-foreground">Amount varies each month</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('isVariableAmount')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.isVariableAmount ? 'bg-[var(--color-income)]' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-card)] transition-transform ${
                formData.isVariableAmount ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <Label className="text-muted-foreground text-sm block">Auto-mark Paid</Label>
            <p className="text-xs text-muted-foreground">Automatically mark as paid on match</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('autoMarkPaid')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.autoMarkPaid ? 'bg-[var(--color-income)]' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-card)] transition-transform ${
                formData.autoMarkPaid ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Payee Patterns */}
      <div>
        <Label className="text-muted-foreground text-sm mb-2 block">Payee Patterns (Optional)</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Add patterns to match transaction descriptions (e.g., "Electric", "Power Company")
        </p>
        <div className="space-y-2">
          {formData.payeePatterns.map((pattern: string, index: number) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-card border border-border rounded"
            >
              <span className="text-sm text-foreground">{pattern}</span>
              <button
                type="button"
                onClick={() => handleRemovePayeePattern(index)}
                className="text-xs text-[var(--color-error)] hover:text-[var(--color-error)]/80"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={newPayeePattern}
              onChange={(e) => setNewPayeePattern(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddPayeePattern();
                }
              }}
              placeholder="Enter a pattern"
              className="bg-elevated border-border text-foreground placeholder:text-muted-foreground text-sm"
            />
            <Button
              type="button"
              onClick={handleAddPayeePattern}
              className="bg-elevated border-border text-foreground hover:bg-elevated text-sm"
            >
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label className="text-muted-foreground text-sm mb-2 block">Notes (Optional)</Label>
        <Textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Add any additional notes..."
          className="bg-elevated border-border text-foreground placeholder:text-muted-foreground resize-none"
          rows={3}
        />
      </div>

      {/* Info Box */}
      <div className="p-4 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-lg flex gap-2">
        <AlertCircle className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
        <div className="text-sm text-[var(--color-primary)]/80">
          <p className="font-medium mb-1">Category-Based Bill Matching</p>
          <p>
            When you create an expense transaction with the selected category, the oldest unpaid bill instance
            will be automatically marked as paid. This handles late payments, early payments, and multiple
            payments intelligently.
          </p>
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
            {bill
              ? isLoading && saveMode === 'save'
                ? 'Updating...'
                : 'Update Bill'
              : isLoading && saveMode === 'save'
              ? 'Saving...'
              : 'Save'}
          </Button>
          {!bill && (
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
          className="w-full bg-elevated border-border text-foreground hover:bg-elevated"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
