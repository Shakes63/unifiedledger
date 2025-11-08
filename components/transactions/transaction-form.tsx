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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AccountSelector } from './account-selector';
import { CategorySelector } from './category-selector';
import { MerchantAutocomplete, MerchantSelectionData } from './merchant-autocomplete';
import { TransactionTemplatesManager } from './transaction-templates-manager';
import { Plus, X, Save } from 'lucide-react';
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
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

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

  const handleDescriptionChange = (value: string, merchantData?: MerchantSelectionData) => {
    setFormData((prev) => ({
      ...prev,
      description: value,
    }));

    // Auto-apply category suggestion if available
    if (merchantData?.suggestedCategoryId && !formData.categoryId) {
      setFormData((prev) => ({
        ...prev,
        categoryId: merchantData.suggestedCategoryId || '',
      }));
    }
  };

  const handleLoadTemplate = (template: any) => {
    setFormData((prev) => ({
      ...prev,
      accountId: template.accountId,
      categoryId: template.categoryId || '',
      amount: template.amount.toString(),
      description: template.description || '',
      notes: template.notes || '',
      type: template.type,
    }));
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setError('Template name is required');
      return;
    }

    setSavingTemplate(true);
    try {
      const response = await fetch('/api/transactions/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          description: formData.description,
          accountId: formData.accountId,
          categoryId: formData.categoryId || null,
          amount: parseFloat(formData.amount),
          type: formData.type,
          notes: formData.notes || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save template');
      }

      setSaveTemplateOpen(false);
      setTemplateName('');
      setError(null);
      // Show success message
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
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
        <MerchantAutocomplete
          value={formData.description}
          onChange={handleDescriptionChange}
          placeholder="e.g., Grocery shopping, Electric bill"
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

      {/* Template Buttons */}
      <div className="flex gap-2 pt-2">
        <TransactionTemplatesManager
          onTemplateSelected={handleLoadTemplate}
          showTrigger={true}
        />

        <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="bg-[#242424] text-white border-[#3a3a3a] hover:bg-[#2a2a2a]"
              disabled={!formData.accountId || !formData.amount || !formData.description}
            >
              <Save className="w-4 h-4 mr-2" />
              Save as Template
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a]">
            <DialogHeader>
              <DialogTitle>Save Transaction as Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name" className="text-sm font-medium text-white">
                  Template Name *
                </Label>
                <Input
                  id="template-name"
                  placeholder="e.g., Monthly Grocery Shopping"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="bg-[#242424] border-[#3a3a3a] text-white"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !templateName.trim()}
                  className="flex-1 bg-white text-black hover:bg-gray-100 font-medium"
                >
                  {savingTemplate ? 'Saving...' : 'Save Template'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSaveTemplateOpen(false)}
                  disabled={savingTemplate}
                  className="bg-[#242424] text-white border-[#3a3a3a] hover:bg-[#2a2a2a]"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
