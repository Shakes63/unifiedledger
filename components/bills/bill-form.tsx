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

interface BillFormProps {
  bill?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function BillForm({
  bill,
  onSubmit,
  onCancel,
  isLoading = false,
}: BillFormProps) {
  const [formData, setFormData] = useState({
    name: bill?.name || '',
    expectedAmount: bill?.expectedAmount || '',
    dueDate: bill?.dueDate || '1',
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

  // Fetch categories, accounts, and debts on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesRes, accountsRes, debtsRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/accounts'),
          fetch('/api/debts?status=active'),
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
  }, []);

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
      return;
    }

    if (!formData.expectedAmount || parseFloat(String(formData.expectedAmount)) <= 0) {
      toast.error('Expected amount must be greater than 0');
      return;
    }

    const dueDate = parseInt(formData.dueDate);
    if (dueDate < 1 || dueDate > 31) {
      toast.error('Due date must be between 1 and 31');
      return;
    }

    onSubmit({
      name: formData.name,
      expectedAmount: parseFloat(String(formData.expectedAmount)),
      dueDate,
      frequency: formData.frequency,
      isVariableAmount: formData.isVariableAmount,
      amountTolerance: parseFloat(String(formData.amountTolerance)) || 5.0,
      categoryId: formData.categoryId || null,
      debtId: formData.debtId || null,
      accountId: formData.accountId || null,
      autoMarkPaid: formData.autoMarkPaid,
      payeePatterns: formData.payeePatterns.length > 0 ? formData.payeePatterns : null,
      notes: formData.notes || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name and Amount */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-400 text-sm mb-2 block">Bill Name*</Label>
          <Input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Electric Bill"
            className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600"
          />
        </div>
        <div>
          <Label className="text-gray-400 text-sm mb-2 block">Expected Amount*</Label>
          <Input
            name="expectedAmount"
            type="number"
            value={formData.expectedAmount}
            onChange={handleChange}
            placeholder="0.00"
            step="0.01"
            className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600"
          />
        </div>
      </div>

      {/* Frequency and Due Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-400 text-sm mb-2 block">Frequency*</Label>
          <Select value={formData.frequency} onValueChange={(value) => handleSelectChange('frequency', value)}>
            <SelectTrigger className="bg-[#242424] border-[#2a2a2a] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
              <SelectItem value="monthly" className="text-white">Monthly</SelectItem>
              <SelectItem value="quarterly" className="text-white">Quarterly (Every 3 months)</SelectItem>
              <SelectItem value="semi-annual" className="text-white">Semi-Annual (Every 6 months)</SelectItem>
              <SelectItem value="annual" className="text-white">Annual (Yearly)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-gray-400 text-sm mb-2 block">Due Date (Day of Month)*</Label>
          <Input
            name="dueDate"
            type="number"
            value={formData.dueDate}
            onChange={handleChange}
            placeholder="1"
            min="1"
            max="31"
            className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">Day of month (1-31)</p>
        </div>
      </div>

      {/* Amount Tolerance */}
      <div>
        <Label className="text-gray-400 text-sm mb-2 block">Amount Tolerance (%)</Label>
        <Input
          name="amountTolerance"
          type="number"
          value={formData.amountTolerance}
          onChange={handleChange}
          placeholder="5.0"
          step="0.1"
          className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600"
        />
        <p className="text-xs text-gray-500 mt-1">For auto-matching (default 5%)</p>
      </div>

      {/* Category and Account */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-400 text-sm mb-2 block">Category (Optional)</Label>
          {!isCreatingCategory ? (
            <div className="flex gap-2">
              <Select value={formData.categoryId} onValueChange={(value) => handleSelectChange('categoryId', value)}>
                <SelectTrigger className="flex-1 bg-[#242424] border-[#2a2a2a] text-white">
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
                className="bg-[#242424] border-[#3a3a3a] text-gray-400 hover:bg-[#2a2a2a]"
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
                className="flex-1 bg-[#1a1a1a] border border-[#3b82f6] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
              />
              <Button
                type="button"
                size="icon"
                onClick={handleCreateCategory}
                disabled={creatingCategory || !newCategoryName.trim()}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
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
                className="bg-[#242424] border-[#3a3a3a] text-gray-400 hover:bg-[#2a2a2a]"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
        <div>
          <Label className="text-gray-400 text-sm mb-2 block">Account (Optional)</Label>
          <Select value={formData.accountId} onValueChange={(value) => handleSelectChange('accountId', value)}>
            <SelectTrigger className="bg-[#242424] border-[#2a2a2a] text-white">
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
        <Label className="text-gray-400 text-sm mb-2 block">Link to Debt (Optional)</Label>
        <p className="text-xs text-gray-500 mb-2">
          Link this bill to a debt to automatically track payments and reduce debt balance
        </p>
        <Select value={formData.debtId || 'none'} onValueChange={(value) => handleSelectChange('debtId', value === 'none' ? '' : value)}>
          <SelectTrigger className="bg-[#242424] border-[#2a2a2a] text-white">
            <SelectValue placeholder="Select debt (optional)" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
            <SelectItem value="none" className="text-white">None</SelectItem>
            {debts.map((debt) => (
              <SelectItem key={debt.id} value={debt.id} className="text-white">
                {debt.name} - ${debt.remainingBalance?.toFixed(2)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Toggles */}
      <div className="space-y-3 p-4 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-gray-400 text-sm block">Variable Amount</Label>
            <p className="text-xs text-gray-500">Amount varies each month</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('isVariableAmount')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.isVariableAmount ? 'bg-emerald-500' : 'bg-[#2a2a2a]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.isVariableAmount ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <Label className="text-gray-400 text-sm block">Auto-mark Paid</Label>
            <p className="text-xs text-gray-500">Automatically mark as paid on match</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('autoMarkPaid')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.autoMarkPaid ? 'bg-emerald-500' : 'bg-[#2a2a2a]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formData.autoMarkPaid ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Payee Patterns */}
      <div>
        <Label className="text-gray-400 text-sm mb-2 block">Payee Patterns (Optional)</Label>
        <p className="text-xs text-gray-500 mb-2">
          Add patterns to match transaction descriptions (e.g., "Electric", "Power Company")
        </p>
        <div className="space-y-2">
          {formData.payeePatterns.map((pattern: string, index: number) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded"
            >
              <span className="text-sm text-gray-300">{pattern}</span>
              <button
                type="button"
                onClick={() => handleRemovePayeePattern(index)}
                className="text-xs text-red-400 hover:text-red-300"
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
              className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600 text-sm"
            />
            <Button
              type="button"
              onClick={handleAddPayeePattern}
              className="bg-[#242424] border-[#2a2a2a] text-white hover:bg-[#2a2a2a] text-sm"
            >
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label className="text-gray-400 text-sm mb-2 block">Notes (Optional)</Label>
        <Textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Add any additional notes..."
          className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600 resize-none"
          rows={3}
        />
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-2">
        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-200">
          <p className="font-medium mb-1">Category-Based Bill Matching</p>
          <p>
            When you create an expense transaction with the selected category, the oldest unpaid bill instance
            will be automatically marked as paid. This handles late payments, early payments, and multiple
            payments intelligently.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-[#2a2a2a]">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-emerald-500 text-white hover:bg-emerald-600 font-medium"
        >
          {isLoading ? (bill ? 'Updating...' : 'Creating...') : bill ? 'Update Bill' : 'Create Bill'}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="flex-1 bg-[#242424] border-[#2a2a2a] text-white hover:bg-[#2a2a2a]"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
