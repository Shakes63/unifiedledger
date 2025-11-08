'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AccountSelector } from './account-selector';
import { CategorySelector } from './category-selector';
import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

type TransactionType = 'income' | 'expense' | 'transfer_in' | 'transfer_out';

interface TransactionFormProps {
  defaultType?: TransactionType;
}

export function TransactionForm({ defaultType = 'expense' }: TransactionFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    accountId: '',
    categoryId: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    description: '',
    notes: '',
    type: defaultType,
    isPending: false,
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type: inputType } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        inputType === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAccountChange = (accountId: string) => {
    setFormData((prev) => ({
      ...prev,
      accountId,
    }));
  };

  const handleCategoryChange = (categoryId: string | null) => {
    setFormData((prev) => ({
      ...prev,
      categoryId: categoryId === 'none' ? '' : categoryId || '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (!formData.accountId || !formData.amount || !formData.description) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create transaction');
      }

      setSuccess(true);
      setFormData({
        accountId: formData.accountId, // Keep the account selected
        categoryId: '',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        description: '',
        notes: '',
        type: defaultType,
        isPending: false,
      });

      // Reset form
      if (formRef.current) {
        formRef.current.reset();
      }

      // Redirect after success
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/40 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-400 text-sm">
          Transaction created successfully! Redirecting...
        </div>
      )}

      {/* Transaction Type */}
      <div className="space-y-2">
        <Label htmlFor="type" className="text-sm font-medium text-white">
          Transaction Type
        </Label>
        <Select value={formData.type} onValueChange={(value) => handleSelectChange('type', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="transfer_out">Transfer Out</SelectItem>
            <SelectItem value="transfer_in">Transfer In</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Account Selection */}
      <AccountSelector
        selectedAccountId={formData.accountId}
        onAccountChange={handleAccountChange}
      />

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount" className="text-sm font-medium text-white">
          Amount *
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.amount}
            onChange={handleInputChange}
            className="pl-7"
            required
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium text-white">
          Description *
        </Label>
        <Input
          id="description"
          name="description"
          placeholder="e.g., Grocery shopping, Electric bill"
          value={formData.description}
          onChange={handleInputChange}
          required
        />
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="date" className="text-sm font-medium text-white">
          Date
        </Label>
        <Input
          id="date"
          name="date"
          type="date"
          value={formData.date}
          onChange={handleInputChange}
        />
      </div>

      {/* Category (skip for transfers) */}
      {formData.type !== 'transfer_in' && formData.type !== 'transfer_out' && (
        <CategorySelector
          selectedCategory={formData.categoryId}
          onCategoryChange={handleCategoryChange}
          transactionType={formData.type as 'income' | 'expense'}
        />
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-medium text-white">
          Notes
        </Label>
        <Input
          id="notes"
          name="notes"
          placeholder="Additional details (optional)"
          value={formData.notes}
          onChange={handleInputChange}
        />
      </div>

      {/* Submit Buttons */}
      <div className="flex gap-2 pt-4">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-white text-black hover:bg-gray-100 font-medium"
        >
          {loading ? 'Creating...' : 'Create Transaction'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
          className="bg-[#242424] text-white border-[#3a3a3a] hover:bg-[#2a2a2a]"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
