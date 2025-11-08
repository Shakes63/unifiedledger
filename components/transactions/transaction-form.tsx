'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { MerchantSelector } from './merchant-selector';
import { TransactionTemplatesManager } from './transaction-templates-manager';
import { SplitBuilder, type Split } from './split-builder';
import { BudgetWarning } from './budget-warning';
import { Plus, X, Save, Split as SplitIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HapticFeedbackTypes } from '@/hooks/useHapticFeedback';

type TransactionType = 'income' | 'expense' | 'transfer';

interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string;
  description?: string;
  icon?: string;
  usageCount: number;
  lastUsedAt?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface CustomField {
  id: string;
  userId: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'url' | 'email';
  description?: string;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  options?: string[] | null;
  defaultValue?: string;
  placeholder?: string;
  validationPattern?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CustomFieldValue {
  id: string;
  fieldId: string;
  transactionId: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

interface TransactionFormProps {
  defaultType?: TransactionType;
  transactionId?: string;
  onEditSuccess?: () => void;
}

export function TransactionForm({ defaultType = 'expense', transactionId, onEditSuccess }: TransactionFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [useSplits, setUseSplits] = useState(false);
  const [splits, setSplits] = useState<Split[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [customFieldsLoading, setCustomFieldsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; currentBalance: number }>>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const isEditMode = !!transactionId;

  // Load tags and custom fields when component mounts
  useEffect(() => {
    const fetchTags = async () => {
      try {
        setTagsLoading(true);
        const response = await fetch('/api/tags?sortBy=usage&limit=100');
        if (!response.ok) throw new Error('Failed to fetch tags');

        const data = await response.json();
        setAllTags(data.data || []);
      } catch (error) {
        console.error('Error fetching tags:', error);
      } finally {
        setTagsLoading(false);
      }
    };

    const fetchCustomFields = async () => {
      try {
        setCustomFieldsLoading(true);
        const response = await fetch('/api/custom-fields?activeOnly=true&limit=100');
        if (!response.ok) throw new Error('Failed to fetch custom fields');

        const data = await response.json();
        const activeFields = (data.data || []).filter((field: CustomField) => field.isActive);
        // Sort by sortOrder
        activeFields.sort((a: CustomField, b: CustomField) => a.sortOrder - b.sortOrder);
        setCustomFields(activeFields);
      } catch (error) {
        console.error('Error fetching custom fields:', error);
      } finally {
        setCustomFieldsLoading(false);
      }
    };

    fetchTags();
    fetchCustomFields();
  }, []);

  // Load existing transaction data when in edit mode
  useEffect(() => {
    if (isEditMode && transactionId) {
      const loadTransaction = async () => {
        try {
          const response = await fetch(`/api/transactions/${transactionId}`);
          if (!response.ok) throw new Error('Failed to load transaction');
          const transaction = await response.json();

          setFormData({
            accountId: transaction.accountId,
            categoryId: transaction.categoryId || '',
            date: transaction.date,
            amount: transaction.amount.toString(),
            description: transaction.description,
            notes: transaction.notes || '',
            type: transaction.type,
            isPending: transaction.isPending,
            toAccountId: '',
          });

          if (transaction.isSplit) {
            setUseSplits(true);
            // Load splits
            const splitsResponse = await fetch(`/api/transactions/${transactionId}/splits`);
            if (splitsResponse.ok) {
              const splitsData = await splitsResponse.json();
              setSplits(splitsData.map((split: any) => ({
                id: split.id,
                categoryId: split.categoryId,
                amount: split.amount,
                percentage: split.percentage,
                isPercentage: split.isPercentage,
                description: split.description,
              })));
            }
          }

          // Load transaction tags
          const tagsResponse = await fetch(`/api/transactions/${transactionId}/tags`);
          if (tagsResponse.ok) {
            const tagsData = await tagsResponse.json();
            setSelectedTagIds(tagsData.map((tag: any) => tag.id));
          }

          // Load custom field values
          const customFieldValuesResponse = await fetch(`/api/custom-field-values?transactionId=${transactionId}`);
          if (customFieldValuesResponse.ok) {
            const valuesData = await customFieldValuesResponse.json();
            const valueMap: Record<string, string> = {};
            (valuesData.data || []).forEach((fieldValue: any) => {
              valueMap[fieldValue.fieldId] = fieldValue.value;
            });
            setCustomFieldValues(valueMap);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load transaction');
        }
      };
      loadTransaction();
    }
  }, [isEditMode, transactionId]);

  // Reset date to today when creating a new transaction
  useEffect(() => {
    if (!isEditMode) {
      setFormData((prev) => ({
        ...prev,
        date: new Date().toISOString().split('T')[0],
      }));
    }
  }, [isEditMode]);

  // Fetch accounts for "To Account" dropdown
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setAccountsLoading(true);
        const response = await fetch('/api/accounts');
        if (response.ok) {
          const data = await response.json();
          setAccounts(data);
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      } finally {
        setAccountsLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodaysDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    accountId: '',
    categoryId: '',
    merchantId: '',
    date: getTodaysDate(),
    amount: '',
    description: '',
    notes: '',
    type: defaultType,
    isPending: false,
    toAccountId: '', // For transfers
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

  const handleMerchantChange = (merchantId: string | null) => {
    setFormData((prev) => ({
      ...prev,
      merchantId: merchantId === 'none' ? '' : merchantId || '',
    }));
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

  const handleAddTag = (tagId: string) => {
    if (!selectedTagIds.includes(tagId)) {
      setSelectedTagIds([...selectedTagIds, tagId]);
    }
  };

  const handleRemoveTag = (tagId: string) => {
    setSelectedTagIds(selectedTagIds.filter(id => id !== tagId));
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Tag name is required');
      return;
    }

    try {
      setCreatingTag(true);
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: '#3b82f6', // Default blue color
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to create tag');
        return;
      }

      const newTag = await response.json();
      // Add new tag to the list
      setAllTags([...allTags, newTag]);
      // Automatically select the new tag
      handleAddTag(newTag.id);
      // Clear the input
      setNewTagName('');
      toast.success(`Tag "${newTag.name}" created and added`);
    } catch (error) {
      console.error('Error creating tag:', error);
      toast.error('Failed to create tag');
    } finally {
      setCreatingTag(false);
    }
  };

  const handleCustomFieldChange = (fieldId: string, value: string) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
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

      const apiUrl = isEditMode
        ? `/api/transactions/${transactionId}`
        : '/api/transactions';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(apiUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} transaction`
        );
      }

      const transactionData = await response.json();
      const txId = transactionData.id || transactionId;

      // Handle tags - add tags after transaction creation/update
      if (selectedTagIds.length > 0) {
        try {
          // In edit mode, delete old tags first
          if (isEditMode) {
            const existingTags = await fetch(`/api/transactions/${txId}/tags`);
            if (existingTags.ok) {
              const existingTagIds = await existingTags.json();
              for (const tag of existingTagIds) {
                await fetch('/api/transaction-tags', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    transactionId: txId,
                    tagId: tag.id,
                  }),
                });
              }
            }
          }

          // Add selected tags
          for (const tagId of selectedTagIds) {
            await fetch('/api/transaction-tags', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transactionId: txId,
                tagId,
              }),
            });
          }
        } catch (tagError) {
          console.error('Error saving tags:', tagError);
          // Don't fail transaction creation if tags fail
        }
      }

      // Handle custom field values - save after transaction creation/update
      if (Object.keys(customFieldValues).length > 0) {
        try {
          // In edit mode, delete old field values first
          if (isEditMode) {
            const existingValues = await fetch(`/api/custom-field-values?transactionId=${txId}`);
            if (existingValues.ok) {
              const existingData = await existingValues.json();
              for (const fieldValue of existingData.data || []) {
                await fetch(`/api/custom-field-values?valueId=${fieldValue.id}`, {
                  method: 'DELETE',
                });
              }
            }
          }

          // Save custom field values
          for (const [fieldId, value] of Object.entries(customFieldValues)) {
            if (value) {
              await fetch('/api/custom-field-values', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  customFieldId: fieldId,
                  transactionId: txId,
                  value,
                }),
              });
            }
          }
        } catch (fieldError) {
          console.error('Error saving custom field values:', fieldError);
          // Don't fail transaction creation if field values fail
        }
      }

      // Handle splits
      if (useSplits && splits.length > 0) {
        if (isEditMode) {
          // In edit mode, delete old splits and create new ones
          const oldSplits = await fetch(`/api/transactions/${txId}/splits`);
          if (oldSplits.ok) {
            const oldSplitsData = await oldSplits.json();
            for (const oldSplit of oldSplitsData) {
              await fetch(`/api/transactions/${txId}/splits/${oldSplit.id}`, {
                method: 'DELETE',
              });
            }
          }
        }

        // Create new splits
        for (const split of splits) {
          const splitResponse = await fetch(`/api/transactions/${txId}/splits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              categoryId: split.categoryId,
              amount: split.amount || 0,
              percentage: split.percentage || 0,
              isPercentage: split.isPercentage,
              description: split.description,
            }),
          });

          if (!splitResponse.ok) {
            const errorData = await splitResponse.json();
            throw new Error(errorData.error || 'Failed to save split');
          }
        }
      }

      setSuccess(true);
      // Haptic feedback on successful transaction creation
      HapticFeedbackTypes.transactionCreated();

      if (isEditMode) {
        // For edit mode, call the callback or go back to details
        setTimeout(() => {
          onEditSuccess?.() || router.push(`/dashboard/transactions/${txId}`);
        }, 1500);
      } else {
        // For create mode, reset form and redirect to dashboard
        setFormData({
          accountId: formData.accountId,
          categoryId: '',
          date: new Date().toISOString().split('T')[0],
          amount: '',
          description: '',
          notes: '',
          type: defaultType,
          isPending: false,
        });
        setUseSplits(false);
        setSplits([]);

        if (formRef.current) {
          formRef.current.reset();
        }

        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }
    } catch (err) {
      // Haptic feedback on error
      HapticFeedbackTypes.transactionError();
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 md:max-w-2xl md:mx-auto">
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
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Account Selection */}
      <div>
        <div className="space-y-2">
          {formData.type === 'transfer' ? (
            <Label className="text-sm font-medium text-white">From Account *</Label>
          ) : null}
          <AccountSelector
            selectedAccountId={formData.accountId}
            onAccountChange={handleAccountChange}
            label={formData.type === 'transfer' ? 'From Account' : 'Account'}
            hideLabel={formData.type === 'transfer'}
          />
        </div>

        {/* To Account Selection (for transfers) */}
        {formData.type === 'transfer' && (
          <div className="mt-4 space-y-2">
            <Label className="text-sm font-medium text-white">
              To Account *
            </Label>
            <Select value={formData.toAccountId} onValueChange={(value) => handleSelectChange('toAccountId', value)}>
              <SelectTrigger className="bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg">
                <SelectValue placeholder="Select destination account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2 w-full">
                      <span className="flex-1 truncate">{account.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        ${account.currentBalance?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount" className="text-sm font-medium text-white">
          Amount *
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-3 md:top-2.5 text-muted-foreground">$</span>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.amount}
            onChange={handleInputChange}
            className="pl-7 h-12 md:h-10 text-base md:text-sm"
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
          type="text"
          placeholder="e.g., Grocery shopping, Electric bill"
          value={formData.description}
          onChange={handleInputChange}
          className="h-12 md:h-10 text-base md:text-sm"
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
          className="h-12 md:h-10 text-base md:text-sm"
        />
      </div>

      {/* Merchant (skip for transfers) */}
      {formData.type !== 'transfer' && (
        <MerchantSelector
          selectedMerchant={formData.merchantId}
          onMerchantChange={handleMerchantChange}
        />
      )}

      {/* Category (skip for transfers and split transactions) */}
      {formData.type !== 'transfer' && !useSplits && (
        <CategorySelector
          selectedCategory={formData.categoryId}
          onCategoryChange={handleCategoryChange}
          transactionType={formData.type as 'income' | 'expense'}
        />
      )}

      {/* Budget Warning */}
      {formData.type === 'expense' && formData.categoryId && (
        <BudgetWarning
          categoryId={formData.categoryId}
          transactionAmount={parseFloat(formData.amount) || 0}
        />
      )}

      {/* Split Transaction Toggle */}
      {formData.type !== 'transfer' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white">Split this transaction?</Label>
          <Button
            type="button"
            variant={useSplits ? 'default' : 'outline'}
            onClick={() => {
              setUseSplits(!useSplits);
              if (!useSplits) {
                setFormData((prev) => ({ ...prev, categoryId: '' }));
                // Auto-populate with 2 splits, copying the main description
                const amount = parseFloat(formData.amount) || 0;
                const halfAmount = amount / 2;
                setSplits([
                  {
                    id: `split-${Date.now()}-1`,
                    categoryId: '',
                    amount: halfAmount,
                    percentage: 0,
                    isPercentage: false,
                    description: formData.description,
                  },
                  {
                    id: `split-${Date.now()}-2`,
                    categoryId: '',
                    amount: halfAmount,
                    percentage: 0,
                    isPercentage: false,
                    description: formData.description,
                  },
                ]);
              } else {
                setSplits([]);
              }
            }}
            className={`w-full h-12 md:h-10 text-base md:text-sm ${
              useSplits
                ? 'bg-white text-black hover:bg-gray-100'
                : 'bg-[#242424] text-white border-[#3a3a3a] hover:bg-[#2a2a2a]'
            }`}
          >
            <SplitIcon className="w-4 h-4 mr-2" />
            {useSplits ? 'Using Splits' : 'Add Splits'}
          </Button>
        </div>
      )}

      {/* Split Builder */}
      {useSplits && formData.amount && (
        <SplitBuilder
          transactionAmount={parseFloat(formData.amount)}
          splits={splits}
          onSplitsChange={setSplits}
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
          className="h-12 md:h-10 text-base md:text-sm"
          name="notes"
          placeholder="Additional details (optional)"
          value={formData.notes}
          onChange={handleInputChange}
        />
      </div>

      {/* Custom Fields */}
      {customFields.length > 0 && (
        <div className="space-y-4 border-t border-[#2a2a2a] pt-4">
          <div className="space-y-3">
            {customFields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id} className="text-sm font-medium text-white">
                  {field.name}
                  {field.isRequired && <span className="text-red-400 ml-1">*</span>}
                </Label>

                {field.type === 'text' && (
                  <Input
                    id={field.id}
                    type="text"
                    placeholder={field.placeholder || ''}
                    value={customFieldValues[field.id] || ''}
                    onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                    required={field.isRequired}
                  />
                )}

                {field.type === 'email' && (
                  <Input
                    id={field.id}
                    type="email"
                    placeholder={field.placeholder || ''}
                    value={customFieldValues[field.id] || ''}
                    onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                    required={field.isRequired}
                  />
                )}

                {field.type === 'url' && (
                  <Input
                    id={field.id}
                    type="url"
                    placeholder={field.placeholder || ''}
                    value={customFieldValues[field.id] || ''}
                    onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                    required={field.isRequired}
                  />
                )}

                {field.type === 'number' && (
                  <Input
                    id={field.id}
                    type="number"
                    step="0.01"
                    placeholder={field.placeholder || ''}
                    value={customFieldValues[field.id] || ''}
                    onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                    required={field.isRequired}
                  />
                )}

                {field.type === 'date' && (
                  <Input
                    id={field.id}
                    type="date"
                    value={customFieldValues[field.id] || ''}
                    onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                    required={field.isRequired}
                  />
                )}

                {field.type === 'checkbox' && (
                  <div className="flex items-center gap-2">
                    <input
                      id={field.id}
                      type="checkbox"
                      checked={customFieldValues[field.id] === 'true' || customFieldValues[field.id] === '1'}
                      onChange={(e) => handleCustomFieldChange(field.id, e.target.checked ? 'true' : '')}
                      className="w-4 h-4 rounded border-[#3a3a3a] bg-[#242424] cursor-pointer"
                    />
                    <Label htmlFor={field.id} className="text-sm text-gray-300 cursor-pointer">
                      {field.description && <span className="text-gray-500">{field.description}</span>}
                    </Label>
                  </div>
                )}

                {field.type === 'select' && field.options && (
                  <select
                    id={field.id}
                    value={customFieldValues[field.id] || ''}
                    onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                    required={field.isRequired}
                    className="w-full px-3 py-2 bg-[#242424] border border-[#3a3a3a] text-white rounded-lg hover:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    <option value="">Select an option</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === 'multiselect' && field.options && (
                  <select
                    id={field.id}
                    multiple
                    value={customFieldValues[field.id]?.split(',').filter(Boolean) || []}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                      handleCustomFieldChange(field.id, selected.join(','));
                    }}
                    className="w-full px-3 py-2 bg-[#242424] border border-[#3a3a3a] text-white rounded-lg hover:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {field.description && field.type !== 'checkbox' && (
                  <p className="text-xs text-gray-500">{field.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-white">Tags (Optional)</Label>

        {/* Selected Tags Display */}
        {selectedTagIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTagIds.map(tagId => {
              const tag = allTags.find(t => t.id === tagId);
              return tag ? (
                <Badge
                  key={tag.id}
                  className="text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag.id)}
                    className="ml-1 hover:opacity-70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ) : null;
            })}
          </div>
        )}

        {/* Tag Selector Dropdown */}
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            onClick={() => setTagsOpen(!tagsOpen)}
            disabled={tagsLoading || loading}
            className="border-[#2a2a2a] text-gray-400 hover:text-white w-full justify-start"
          >
            <Plus className="w-4 h-4 mr-2" />
            {selectedTagIds.length > 0 ? 'Add more tags' : 'Add tags'}
          </Button>

          {tagsOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
              {allTags
                .filter(tag => !selectedTagIds.includes(tag.id))
                .map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      handleAddTag(tag.id);
                      if (allTags.filter(t => !selectedTagIds.includes(t.id)).length === 1) {
                        setTagsOpen(false);
                      }
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#242424] transition-colors flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: tag.color }}
                    />
                    <div className="flex-1">
                      <p className="text-sm text-white">{tag.name}</p>
                      {tag.description && (
                        <p className="text-xs text-gray-500">{tag.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{tag.usageCount}</span>
                  </button>
                ))}

              {/* Create New Tag Section */}
              <div className="border-t border-[#2a2a2a] px-3 py-2 space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="New tag name..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateTag();
                      }
                    }}
                    disabled={creatingTag}
                    className="bg-[#242424] border-[#2a2a2a] text-white placeholder-gray-600 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateTag}
                    disabled={creatingTag || !newTagName.trim()}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template Buttons */}
      <div className="flex gap-2 pt-2 flex-col md:flex-row">
        <div className="flex-1">
          <TransactionTemplatesManager
            onTemplateSelected={handleLoadTemplate}
            showTrigger={true}
          />
        </div>

        <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="bg-[#242424] text-white border-[#3a3a3a] hover:bg-[#2a2a2a] w-full h-10 text-sm"
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

      {/* Submit Buttons - Mobile optimized with 44px minimum height */}
      <div className="flex gap-2 pt-4 flex-col md:flex-row md:pb-0 pb-4">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-white text-black hover:bg-gray-100 font-medium h-12 md:h-10 text-base md:text-sm"
        >
          {isEditMode
            ? loading
              ? 'Updating...'
              : 'Update Transaction'
            : loading
            ? 'Creating...'
            : 'Create Transaction'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
          className="bg-[#242424] text-white border-[#3a3a3a] hover:bg-[#2a2a2a] h-12 md:h-10 text-base md:text-sm md:px-6 px-4"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
