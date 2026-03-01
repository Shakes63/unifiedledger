'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
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
  DialogDescription,
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
import { GoalSelector } from './goal-selector';
import { useHouseholdAccounts } from './hooks/use-household-accounts';
import { useTransferDetections } from './hooks/use-transfer-detections';
import { useUnpaidBills, type UnpaidBillWithInstance } from './hooks/use-unpaid-bills';
import {
  syncTransactionCustomFields,
  syncTransactionSplits,
  syncTransactionTags,
} from './transaction-form-persistence';

// Type for goal contributions in split mode
interface GoalContribution {
  goalId: string;
  amount: number;
}
import { Plus, X, Save, Split as SplitIcon, Target, Info, ExternalLink, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HapticFeedbackTypes } from '@/hooks/useHapticFeedback';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { Loader2 } from 'lucide-react';
import { getTodayLocalDateString } from '@/lib/utils/local-date';
import { TransactionFormActions } from '@/components/transactions/transaction-form-actions';

type TransactionType = 'income' | 'expense' | 'transfer' | 'bill';

// Split data from API
interface SplitData {
  id: string;
  categoryId: string;
  amount: number;
  percentage: number;
  isPercentage: boolean;
  description: string;
}

// Custom field value from API
interface CustomFieldValueData {
  fieldId: string;
  value: string;
}

// Transaction template - matches the Template interface from TransactionTemplatesManager
interface TransactionTemplate {
  id: string;
  name: string;
  description?: string;
  accountId?: string;
  categoryId?: string;
  merchantId?: string;
  amount?: number;
  type: 'income' | 'expense' | 'transfer' | 'transfer_in' | 'transfer_out' | 'bill';
  notes?: string;
}

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

interface _CustomFieldValue {
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
  const { initialized, loading: householdLoading, selectedHouseholdId: householdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold, putWithHousehold, selectedHouseholdId } = useHouseholdFetch();
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
  const [_customFieldsLoading, setCustomFieldsLoading] = useState(true);
  const [selectedBillInstanceId, setSelectedBillInstanceId] = useState<string>('');
  const [salesTaxEnabled, setSalesTaxEnabled] = useState(false);
  const [merchantIsSalesTaxExempt, setMerchantIsSalesTaxExempt] = useState(false);
  const [useCategoryTaxDefault, setUseCategoryTaxDefault] = useState(true);
  const [transactionTaxDeductible, setTransactionTaxDeductible] = useState(false);
  const [transactionTaxDeductionType, setTransactionTaxDeductionType] = useState<
    'business' | 'personal'
  >('personal');
  const [saveMode, setSaveMode] = useState<'save' | 'saveAndAdd' | null>(null);
  // Phase 18: Savings goal linking
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [goalContributions, setGoalContributions] = useState<GoalContribution[]>([]);
  const isEditMode = !!transactionId;

  // Helper function to get today's date in local YYYY-MM-DD format
  const getTodaysDate = () => {
    return getTodayLocalDateString();
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

  const canLoadHouseholdData = Boolean(selectedHouseholdId && householdId);
  const { accounts } = useHouseholdAccounts({
    enabled: canLoadHouseholdData,
    fetchWithHousehold,
    emptySelectionMessage: 'No household selected',
  });
  const {
    unpaidBills,
    loading: billsLoading,
    refresh: refreshUnpaidBills,
  } = useUnpaidBills({
    enabled: formData.type === 'bill' && canLoadHouseholdData,
    fetchWithHousehold,
  });
  const {
    savingsDetection: detectionResult,
    paymentBillDetection,
    loadingSavingsDetection: detectionLoading,
  } = useTransferDetections({
    enabled: formData.type === 'transfer' && canLoadHouseholdData,
    toAccountId: formData.toAccountId,
    fetchWithHousehold,
  });

  // Compute whether selected account is a business account for category filtering
  const selectedAccountIsBusinessAccount = useMemo(() => {
    const account = accounts.find(a => a.id === formData.accountId);
    return account?.isBusinessAccount || false;
  }, [accounts, formData.accountId]);

  // Load tags and custom fields when component mounts
  useEffect(() => {
    const fetchTags = async () => {
      try {
        setTagsLoading(true);
        const response = await fetch('/api/tags?sortBy=usage&limit=100', { credentials: 'include' });
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
        const response = await fetch('/api/custom-fields?activeOnly=true&limit=100', { credentials: 'include' });
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
      if (!selectedHouseholdId) {
        setLoading(false);
        return;
      }

      const loadTransaction = async () => {
        try {
          const response = await fetchWithHousehold(`/api/transactions/${transactionId}`);
          if (!response.ok) throw new Error('Failed to load transaction');
          const transaction = await response.json();

          // Convert transfer_out/transfer_in to 'transfer' for the UI
          let formType: TransactionType = transaction.type;
          if (transaction.type === 'transfer_out' || transaction.type === 'transfer_in') {
            formType = 'transfer';
          }

          setFormData({
            accountId: transaction.accountId,
            categoryId: transaction.categoryId || '',
            merchantId: transaction.merchantId || '',
            date: transaction.date,
            amount: transaction.amount.toString(),
            description: transaction.description,
            notes: transaction.notes || '',
            type: formType,
            isPending: transaction.isPending,
            toAccountId: '',
          });
          setTransactionTaxDeductible(Boolean(transaction.isTaxDeductible));
          setTransactionTaxDeductionType(
            transaction.taxDeductionType === 'business' ? 'business' : 'personal'
          );
          setUseCategoryTaxDefault(false);

          if (transaction.isSplit) {
            setUseSplits(true);
            // Load splits
            const splitsResponse = await fetchWithHousehold(`/api/transactions/${transactionId}/splits`);
            if (splitsResponse.ok) {
              const splitsData = await splitsResponse.json();
              setSplits(splitsData.map((split: SplitData) => ({
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
          const tagsResponse = await fetchWithHousehold(`/api/transactions/${transactionId}/tags`);
          if (tagsResponse.ok) {
            const tagsData = await tagsResponse.json();
            setSelectedTagIds(tagsData.map((tag: Tag) => tag.id));
          }

          // Load custom field values
          const customFieldValuesResponse = await fetch(`/api/custom-field-values?transactionId=${transactionId}`, { credentials: 'include' });
          if (customFieldValuesResponse.ok) {
            const valuesData = await customFieldValuesResponse.json();
            const valueMap: Record<string, string> = {};
            (valuesData.data || []).forEach((fieldValue: CustomFieldValueData) => {
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
  }, [isEditMode, transactionId, selectedHouseholdId, fetchWithHousehold]);

  // Reset date to today when creating a new transaction
  useEffect(() => {
    if (!isEditMode) {
      setFormData((prev) => ({
        ...prev,
        date: getTodaysDate(),
      }));
    }
  }, [isEditMode]);

  useEffect(() => {
    if (formData.type !== 'transfer' || !detectionResult?.suggestedGoalId || detectionResult.confidence !== 'high') {
      return;
    }

    setSelectedGoalId(detectionResult.suggestedGoalId);
    const amount = parseFloat(formData.amount);
    if (amount > 0) {
      setGoalContributions([{ goalId: detectionResult.suggestedGoalId, amount }]);
    }
  }, [detectionResult, formData.type, formData.amount]);

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
    
    // Auto-enable sales tax when switching to income type with a sales-tax-enabled account
    if (name === 'type' && value === 'income') {
      const selectedAccount = accounts.find(a => a.id === formData.accountId);
      if (selectedAccount?.enableSalesTax) {
        setSalesTaxEnabled(true);
      }
    }
  };

  const handleAccountChange = (accountId: string) => {
    setFormData((prev) => ({
      ...prev,
      accountId,
    }));
    
    // Auto-enable/disable sales tax for income transactions based on account's sales tax setting
    if (formData.type === 'income') {
      const selectedAccount = accounts.find(a => a.id === accountId);
      setSalesTaxEnabled(selectedAccount?.enableSalesTax || false);
    }
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

  const handleBillSelect = (billInstanceId: string) => {
    setSelectedBillInstanceId(billInstanceId);

    if (billInstanceId === 'none') {
      // Reset form when "none" is selected
      setFormData((prev) => ({
        ...prev,
        amount: '',
        description: '',
        categoryId: '',
      }));
      return;
    }

    // Find the selected bill instance
    const billInstance = unpaidBills.find((b: UnpaidBillWithInstance) => b.instance.id === billInstanceId);
    if (billInstance) {
      // Pre-populate form with bill data
      setFormData((prev) => ({
        ...prev,
        amount: billInstance.instance.expectedAmount?.toString() || '',
        description: billInstance.bill.name || '',
        categoryId: billInstance.bill.categoryId || '',
        merchantId: billInstance.bill.merchantId || '',
        notes: `Payment for ${billInstance.bill.name} (Due: ${format(parseISO(billInstance.instance.dueDate), 'MMM d, yyyy')})`,
      }));
    }
  };

  const handleLoadTemplate = (template: TransactionTemplate) => {
    // Convert template type to valid TransactionType (transfer_in/transfer_out become transfer)
    let formType: TransactionType = 'expense';
    if (template.type === 'income' || template.type === 'expense' || template.type === 'transfer' || template.type === 'bill') {
      formType = template.type;
    } else if (template.type === 'transfer_in' || template.type === 'transfer_out') {
      formType = 'transfer';
    }
    
    setFormData((prev) => ({
      ...prev,
      accountId: template.accountId || prev.accountId,
      categoryId: template.categoryId || '',
      amount: template.amount?.toString() || '',
      description: template.description || '',
      notes: template.notes || '',
      type: formType,
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
          color: 'var(--color-primary)', // Default primary color
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
      const response = await postWithHousehold('/api/transactions/templates', {
        name: templateName,
        description: formData.description,
        accountId: formData.accountId,
        categoryId: formData.categoryId || null,
        amount: parseFloat(formData.amount),
        type: formData.type,
        notes: formData.notes || null,
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
      // Guard: Check if household context is ready
      if (!initialized || householdLoading) {
        setError('Please wait while household data loads...');
        setLoading(false);
        return;
      }

      if (!selectedHouseholdId || !householdId) {
        setError('Please select a household to continue.');
        setLoading(false);
        return;
      }

      if (!formData.accountId || !formData.amount || !formData.description) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      const apiUrl = isEditMode
        ? `/api/transactions/${transactionId}`
        : '/api/transactions';

      // Convert 'bill' type to 'expense' for API submission
      const submitData = {
        ...formData,
        type: formData.type === 'bill' ? 'expense' : formData.type,
        // Include bill instance ID for direct bill payment matching
        billInstanceId: formData.type === 'bill' && selectedBillInstanceId && selectedBillInstanceId !== 'none' ? selectedBillInstanceId : undefined,
        // Include sales tax boolean for income transactions
        isSalesTaxable: formData.type === 'income' ? salesTaxEnabled : false,
        // Phase 18: Include savings goal link for transfers
        savingsGoalId: formData.type === 'transfer' && selectedGoalId ? selectedGoalId : undefined,
        // Phase 18: Include goal contributions for split contributions
        goalContributions: formData.type === 'transfer' && goalContributions.length > 0 ? goalContributions : undefined,
        useCategoryTaxDefault: formData.type === 'transfer' ? true : useCategoryTaxDefault,
        isTaxDeductible:
          formData.type === 'transfer' || useCategoryTaxDefault ? undefined : transactionTaxDeductible,
        taxDeductionType:
          formData.type === 'transfer' || useCategoryTaxDefault || !transactionTaxDeductible
            ? undefined
            : transactionTaxDeductionType,
      };

      const response = isEditMode
        ? await putWithHousehold(apiUrl, submitData)
        : await postWithHousehold(apiUrl, submitData);

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} transaction`;
        
        // Distinguish between auth errors (401) and household auth errors (403)
        if (response.status === 401) {
          // Authentication failure - session expired, let middleware handle redirect
          toast.error('Your session has expired. Please sign in again.');
          // Don't throw error, let middleware redirect
          setLoading(false);
          return;
        }
        
        if (response.status === 403) {
          // Household authorization failure - show error but don't sign out
          toast.error(errorMessage);
          throw new Error(errorMessage);
        }
        
        // Other errors
        throw new Error(errorMessage);
      }

      const transactionData = await response.json();
      const txId = transactionData.id || transactionId;

      // Handle tags - add tags after transaction creation/update
      if (selectedTagIds.length > 0) {
        try {
          await syncTransactionTags({
            transactionId: txId,
            selectedTagIds,
            isEditMode,
            fetchWithHousehold,
          });
        } catch (tagError) {
          console.error('Error saving tags:', tagError);
          // Don't fail transaction creation if tags fail
        }
      }

      // Handle custom field values - save after transaction creation/update
      if (Object.keys(customFieldValues).length > 0) {
        try {
          await syncTransactionCustomFields({
            transactionId: txId,
            customFieldValues,
            isEditMode,
          });
        } catch (fieldError) {
          console.error('Error saving custom field values:', fieldError);
          // Don't fail transaction creation if field values fail
        }
      }

      // Handle splits using batch API (single atomic operation)
      await syncTransactionSplits({
        transactionId: txId,
        useSplits,
        splits,
        isEditMode,
        putWithHousehold,
      });

      setSuccess(true);
      // Haptic feedback on successful transaction creation
      HapticFeedbackTypes.transactionCreated();

      // Refresh bills if transaction type was 'bill' or 'expense' (could affect bills)
      if (formData.type === 'bill' || formData.type === 'expense') {
        // Refresh unpaid bills in this component if type is 'bill'
        if (formData.type === 'bill') {
          void refreshUnpaidBills();
        }
        
        // Emit event for other components (bills page, widgets) to refresh
        window.dispatchEvent(new CustomEvent('bills-refresh', {
          detail: { transactionType: formData.type }
        }));
      }

      if (isEditMode) {
        // For edit mode, call the callback or go back to details
        setTimeout(() => {
          if (onEditSuccess) {
            onEditSuccess();
          } else {
            router.push(`/dashboard/transactions/${txId}`);
          }
        }, 1500);
      } else {
        // For create mode, check save mode
        if (saveMode === 'saveAndAdd') {
          // Save & Add Another: Reset form but keep account and type
          const preservedAccount = formData.accountId;
          const preservedType = formData.type;

          toast.success(`Transaction "${formData.description}" saved successfully!`);

          // Reset all form fields
          setFormData({
            accountId: preservedAccount,
            categoryId: '',
            merchantId: '',
            date: getTodaysDate(),
            amount: '',
            description: '',
            notes: '',
            type: preservedType,
            isPending: false,
            toAccountId: '',
          });
          setUseCategoryTaxDefault(true);
          setTransactionTaxDeductible(false);
          setTransactionTaxDeductionType('personal');

          // Reset other form state
          setUseSplits(false);
          setSplits([]);
          setSelectedTagIds([]);
          setCustomFieldValues({});
          // Re-enable sales tax if preserved account has it enabled and type is income
          const preservedAccountObj = accounts.find(a => a.id === preservedAccount);
          setSalesTaxEnabled(preservedType === 'income' && (preservedAccountObj?.enableSalesTax || false));
          setMerchantIsSalesTaxExempt(false);
          setSelectedBillInstanceId('');
          // Phase 18: Reset savings goal selection
          setSelectedGoalId(null);
          setGoalContributions([]);
          setSuccess(false);
          setSaveMode(null);

          // Focus on description field for quick data entry
          setTimeout(() => {
            document.getElementById('description')?.focus();
          }, 100);
        } else {
          // Regular Save: Reset form and redirect to dashboard
          setFormData({
            accountId: formData.accountId,
            categoryId: '',
            merchantId: '',
            date: getTodaysDate(),
            amount: '',
            description: '',
            notes: '',
            type: defaultType,
            isPending: false,
            toAccountId: '',
          });
          setUseCategoryTaxDefault(true);
          setTransactionTaxDeductible(false);
          setTransactionTaxDeductionType('personal');
          setUseSplits(false);
          setSplits([]);
          // Phase 18: Reset savings goal selection
          setSelectedGoalId(null);
          setGoalContributions([]);

          if (formRef.current) {
            formRef.current.reset();
          }

          setTimeout(() => {
            if (onEditSuccess) {
              onEditSuccess();
            } else {
              router.push('/dashboard');
            }
          }, 1500);
        }
      }
    } catch (err) {
      // Haptic feedback on error
      HapticFeedbackTypes.transactionError();
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSaveMode(null); // Reset save mode on error
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while household context initializes
  if (!initialized || householdLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--color-muted-foreground)' }}>Loading household data...</p>
        </div>
      </div>
    );
  }

  // Show error state if no household is selected
  if (!selectedHouseholdId || !householdId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <div className="p-6 text-center">
            <p className="mb-4" style={{ color: 'var(--color-foreground)' }}>No household selected</p>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted-foreground)' }}>
              Please select a household to create transactions.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 md:max-w-2xl md:mx-auto">
      {error && (
        <div className="p-4 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 20%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 40%, transparent)', color: 'var(--color-destructive)' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg text-sm" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 20%, transparent)', border: '1px solid color-mix(in oklch, var(--color-success) 40%, transparent)', color: 'var(--color-success)' }}>
          Transaction {isEditMode ? 'updated' : 'created'} successfully! Redirecting...
        </div>
      )}

      {/* Transaction Type */}
      <div className="space-y-2">
        <Label htmlFor="type" className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
          Transaction Type
        </Label>
        <Select value={formData.type} onValueChange={(value) => handleSelectChange('type', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bill">Bill Payment</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bill Selector (for bill payments) */}
      {formData.type === 'bill' && (
        <div className="space-y-2">
          <Label htmlFor="billInstance" className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
            Select Bill to Pay *
          </Label>
          <Select value={selectedBillInstanceId || 'none'} onValueChange={handleBillSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select a bill to pay" />
            </SelectTrigger>
            <SelectContent style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
              <SelectItem value="none">Select a bill</SelectItem>
              {billsLoading ? (
                <SelectItem value="loading" disabled>Loading bills...</SelectItem>
              ) : unpaidBills.length === 0 ? (
                <SelectItem value="empty" disabled>No unpaid bills</SelectItem>
              ) : (
                unpaidBills.map((item: UnpaidBillWithInstance) => (
                  <SelectItem key={item.instance.id} value={item.instance.id}>
                    <div style={{ color: item.instance.status === 'overdue' ? 'var(--color-destructive)' : 'var(--color-foreground)' }}>
                      {item.instance.status === 'overdue' && (
                        <span className="font-semibold">OVERDUE - </span>
                      )}
                      {item.bill.name} - ${item.instance.expectedAmount?.toFixed(2)} (Due: {format(parseISO(item.instance.dueDate), 'MMM d, yyyy')})
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            Selecting a bill will pre-fill the form. You can still edit any field before submitting.
          </p>
        </div>
      )}

      {/* Account Selection */}
      <div>
        <div className="space-y-2">
          {formData.type === 'transfer' ? (
            <Label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>From Account *</Label>
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
            <Label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
              To Account *
            </Label>
            <Select value={formData.toAccountId} onValueChange={(value) => handleSelectChange('toAccountId', value)}>
              <SelectTrigger className="rounded-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                <SelectValue placeholder="Select destination account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2 w-full">
                      <span className="flex-1 truncate">{account.name}</span>
                      <span className="text-xs shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
                        ${account.currentBalance?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Phase 5: Payment Bill Auto-Detection Banner */}
        {formData.type === 'transfer' && formData.toAccountId && paymentBillDetection && paymentBillDetection.confidence !== 'none' && (
          <div
            className="mt-4 p-3 rounded-lg flex items-start gap-3"
            style={{
              backgroundColor: paymentBillDetection.detectedBill?.status === 'overdue'
                ? 'color-mix(in oklch, var(--color-destructive) 10%, transparent)'
                : paymentBillDetection.confidence === 'high'
                  ? 'color-mix(in oklch, var(--color-primary) 10%, transparent)'
                  : paymentBillDetection.confidence === 'medium'
                    ? 'color-mix(in oklch, var(--color-primary) 5%, transparent)'
                    : 'var(--color-elevated)',
              border: `1px solid ${
                paymentBillDetection.detectedBill?.status === 'overdue'
                  ? 'color-mix(in oklch, var(--color-destructive) 30%, transparent)'
                  : paymentBillDetection.confidence === 'high'
                    ? 'color-mix(in oklch, var(--color-primary) 30%, transparent)'
                    : paymentBillDetection.confidence === 'medium'
                      ? 'color-mix(in oklch, var(--color-primary) 20%, transparent)'
                      : 'var(--color-border)'
              }`,
            }}
          >
            <CreditCard className="w-5 h-5 shrink-0 mt-0.5" style={{ color: paymentBillDetection.detectedBill?.status === 'overdue' ? 'var(--color-destructive)' : 'var(--color-primary)' }} />
            <div className="flex-1 min-w-0">
              {paymentBillDetection.detectedBill ? (
                <>
                  <p className="text-sm font-medium" style={{ color: paymentBillDetection.detectedBill.status === 'overdue' ? 'var(--color-destructive)' : 'var(--color-foreground)' }}>
                    {paymentBillDetection.detectedBill.templateName}
                    {paymentBillDetection.detectedBill.status === 'overdue' && (
                      <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 20%, transparent)' }}>
                        OVERDUE
                      </span>
                    )}
                    {paymentBillDetection.detectedBill.status === 'partial' && (
                      <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 20%, transparent)', color: 'var(--color-warning)' }}>
                        PARTIAL
                      </span>
                    )}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                    Due: {format(parseISO(paymentBillDetection.detectedBill.dueDate), 'MMM d, yyyy')}
                    {' '}&middot;{' '}
                    ${(paymentBillDetection.detectedBill.expectedAmountCents / 100).toFixed(2)}
                    {paymentBillDetection.detectedBill.status === 'partial' && (
                      <span style={{ color: 'var(--color-warning)' }}>
                        {' '}(${(paymentBillDetection.detectedBill.remainingAmountCents / 100).toFixed(2)} remaining)
                      </span>
                    )}
                  </p>
                </>
              ) : null}
              <p className="text-xs mt-1" style={{ color: paymentBillDetection.detectedBill?.status === 'overdue' ? 'var(--color-destructive)' : paymentBillDetection.confidence === 'high' ? 'var(--color-primary)' : 'var(--color-muted-foreground)' }}>
                {paymentBillDetection.reason}
              </p>
              {paymentBillDetection.confidence === 'low' && !paymentBillDetection.detectedBill && (
                <a
                  href="/dashboard/bills"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs hover:underline mt-1"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Set up payment bill <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Phase 18: Savings Goal Auto-Detection Banner */}
        {formData.type === 'transfer' && formData.toAccountId && detectionResult && detectionResult.confidence !== 'none' && (
          <div
            className="mt-4 p-3 rounded-lg flex items-start gap-3"
            style={{
              backgroundColor: detectionResult.confidence === 'high'
                ? 'color-mix(in oklch, var(--color-primary) 10%, transparent)'
                : detectionResult.confidence === 'medium'
                  ? 'color-mix(in oklch, var(--color-primary) 5%, transparent)'
                  : 'var(--color-elevated)',
              border: `1px solid ${
                detectionResult.confidence === 'high'
                  ? 'color-mix(in oklch, var(--color-primary) 30%, transparent)'
                  : detectionResult.confidence === 'medium'
                    ? 'color-mix(in oklch, var(--color-primary) 20%, transparent)'
                    : 'var(--color-border)'
              }`,
            }}
          >
            {detectionResult.confidence === 'high' ? (
              <Target className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
            ) : (
              <Info className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--color-muted-foreground)' }} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: detectionResult.confidence === 'high' ? 'var(--color-primary)' : 'var(--color-foreground)' }}>
                {detectionResult.reason}
              </p>
              {detectionResult.confidence === 'low' && (
                <a
                  href="/dashboard/goals"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs hover:underline mt-1"
                style={{ color: 'var(--color-primary)' }}
                >
                  Create a goal <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Phase 18: Savings Goal Selector for transfers to savings accounts */}
        {formData.type === 'transfer' && formData.toAccountId && (
          <div className="mt-4">
            <GoalSelector
              selectedGoalId={selectedGoalId}
              selectedContributions={goalContributions}
              multiSelect={true}
              accountId={formData.toAccountId}
              transactionAmount={parseFloat(formData.amount) || 0}
              onChange={(goalId) => {
                setSelectedGoalId(goalId);
                // Clear split contributions when switching to single goal
                if (goalId) {
                  setGoalContributions([]);
                }
              }}
              onContributionsChange={(contributions) => {
                setGoalContributions(contributions);
                // Clear single goal selection when using split
                if (contributions.length > 1) {
                  setSelectedGoalId(null);
                } else if (contributions.length === 1) {
                  setSelectedGoalId(contributions[0].goalId);
                }
              }}
              disabled={loading || detectionLoading}
            />
          </div>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount" className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
          Amount *
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-3 md:top-2.5" style={{ color: 'var(--color-muted-foreground)' }}>$</span>
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
        <Label htmlFor="description" className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
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
        <Label htmlFor="date" className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
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
          onMerchantExemptChange={setMerchantIsSalesTaxExempt}
        />
      )}

      {/* Category (skip for transfers and split transactions) */}
      {formData.type !== 'transfer' && !useSplits && (
        <CategorySelector
          selectedCategory={formData.categoryId}
          onCategoryChange={handleCategoryChange}
          transactionType={(formData.type === 'bill' ? 'expense' : formData.type) as 'income' | 'expense'}
          isBusinessAccount={selectedAccountIsBusinessAccount}
        />
      )}

      {/* Budget Warning */}
      {(formData.type === 'expense' || formData.type === 'bill') && formData.categoryId && (
        <BudgetWarning
          categoryId={formData.categoryId}
          transactionAmount={parseFloat(formData.amount) || 0}
        />
      )}

      {/* Split Transaction Toggle */}
      {formData.type !== 'transfer' && formData.type !== 'bill' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>Split this transaction?</Label>
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
            className={`w-full h-12 md:h-10 text-base md:text-sm ${useSplits ? 'hover:opacity-90' : ''}`}
            style={
              useSplits
                ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }
                : { backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)', borderColor: 'var(--color-border)', borderWidth: 1, borderStyle: 'solid' }
            }
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
          mainCategory={formData.categoryId || ''}
          transactionDescription={formData.description || ''}
        />
      )}

      {/* Sales Tax Section - Only for income transactions */}
      {formData.type === 'income' && (
        <div className="border-t pt-4 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
          {merchantIsSalesTaxExempt ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 10%, transparent)', color: 'var(--color-success)', borderColor: 'color-mix(in oklch, var(--color-success) 30%, transparent)' }}>
                Tax Exempt Merchant
              </Badge>
              <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                This income is excluded from sales tax calculations
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="salesTax"
                  checked={salesTaxEnabled}
                  onChange={(e) => setSalesTaxEnabled(e.target.checked)}
                  className="h-4 w-4 rounded focus:ring-2 focus:ring-offset-0"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input)', accentColor: 'var(--color-primary)' }}
                />
                <label
                  htmlFor="salesTax"
                  className="text-sm cursor-pointer"
                style={{ color: 'var(--color-muted-foreground)' }}
                >
                  Subject to sales tax
                </label>
              </div>
              {!salesTaxEnabled && (
                <p className="text-xs ml-6" style={{ color: 'var(--color-muted-foreground)' }}>
                  This income will be excluded from sales tax calculations (tax exempt)
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Tax Deduction Section (non-transfer transactions) */}
      {formData.type !== 'transfer' && (
        <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>Tax Deduction Handling</Label>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            Precedence: transaction override (when enabled) takes priority over category defaults.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useCategoryTaxDefault"
              checked={useCategoryTaxDefault}
              onChange={(e) => setUseCategoryTaxDefault(e.target.checked)}
              className="h-4 w-4 rounded focus:ring-2 focus:ring-offset-0"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input)', accentColor: 'var(--color-primary)' }}
            />
            <label htmlFor="useCategoryTaxDefault" className="text-sm cursor-pointer"
                style={{ color: 'var(--color-muted-foreground)' }}>
              Use category default tax treatment
            </label>
          </div>
          <p className="text-xs ml-6" style={{ color: 'var(--color-muted-foreground)' }}>
            {useCategoryTaxDefault
              ? 'Category defaults are currently active.'
              : 'Transaction-level tax override is currently active.'}
          </p>

          {!useCategoryTaxDefault && (
            <div className="space-y-3 ml-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="transactionTaxDeductible"
                  checked={transactionTaxDeductible}
                  onChange={(e) => setTransactionTaxDeductible(e.target.checked)}
                  className="h-4 w-4 rounded focus:ring-2 focus:ring-offset-0"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input)', accentColor: 'var(--color-primary)' }}
                />
                <label htmlFor="transactionTaxDeductible" className="text-sm cursor-pointer"
                style={{ color: 'var(--color-muted-foreground)' }}>
                  Mark this transaction as tax deductible
                </label>
              </div>

              {transactionTaxDeductible && (
                <div className="space-y-2">
                  <Label htmlFor="transactionTaxDeductionType" className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                    Deduction Type
                  </Label>
                  <Select
                    value={transactionTaxDeductionType}
                    onValueChange={(value) =>
                      setTransactionTaxDeductionType(value as 'business' | 'personal')
                    }
                  >
                    <SelectTrigger id="transactionTaxDeductionType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
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
        <div className="space-y-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="space-y-3">
            {customFields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id} className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                  {field.name}
                  {field.isRequired && <span className="ml-1" style={{ color: 'var(--color-destructive)' }}>*</span>}
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
                      className="w-4 h-4 rounded cursor-pointer"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-elevated)' }}
                    />
                    <Label htmlFor={field.id} className="text-sm cursor-pointer" style={{ color: 'var(--color-foreground)' }}>
                      {field.description && <span style={{ color: 'var(--color-muted-foreground)' }}>{field.description}</span>}
                    </Label>
                  </div>
                )}

                {field.type === 'select' && field.options && (
                  <select
                    id={field.id}
                    value={customFieldValues[field.id] || ''}
                    onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                    required={field.isRequired}
                    className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50"
                    style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
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
                    className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50"
                    style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                  >
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {field.description && field.type !== 'checkbox' && (
                  <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{field.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="space-y-2">
        <Label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>Tags (Optional)</Label>

        {/* Selected Tags Display */}
        {selectedTagIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTagIds.map(tagId => {
              const tag = allTags.find(t => t.id === tagId);
              return tag ? (
                <Badge
                  key={tag.id}
                  style={{ color: 'var(--color-foreground)' }}
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
            className="w-full justify-start"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
          >
            <Plus className="w-4 h-4 mr-2" />
            {selectedTagIds.length > 0 ? 'Add more tags' : 'Add tags'}
          </Button>

          {tagsOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
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
                    className="w-full text-left px-3 py-2 transition-colors flex items-center gap-2 hover:bg-(--color-elevated)"
                  >
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: tag.color }}
                    />
                    <div className="flex-1">
                      <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>{tag.name}</p>
                      {tag.description && (
                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{tag.description}</p>
                      )}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{tag.usageCount}</span>
                  </button>
                ))}

              {/* Create New Tag Section */}
              <div className="border-t px-3 py-2 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
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
                    className="text-sm"
                  style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateTag}
                    disabled={creatingTag || !newTagName.trim()}
                    className="hover:opacity-90"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
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
              className="w-full h-10 text-sm hover:bg-(--color-elevated)"
            style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)', borderColor: 'var(--color-border)' }}
              disabled={!formData.accountId || !formData.amount || !formData.description}
            >
              <Save className="w-4 h-4 mr-2" />
              Save as Template
            </Button>
          </DialogTrigger>
          <DialogContent style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
            <DialogHeader>
              <DialogTitle>Save Transaction as Template</DialogTitle>
              <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>
                Save this transaction configuration as a reusable template for quick entry
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name" className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                  Template Name *
                </Label>
                <Input
                  id="template-name"
                  placeholder="e.g., Monthly Grocery Shopping"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !templateName.trim()}
                  className="flex-1 hover:opacity-90 font-medium"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                >
                  {savingTemplate ? 'Saving...' : 'Save Template'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSaveTemplateOpen(false)}
                  disabled={savingTemplate}
                  className="hover:bg-(--color-elevated)"
                  style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)', borderColor: 'var(--color-border)' }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <TransactionFormActions
        isEditMode={isEditMode}
        loading={loading}
        saveMode={saveMode}
        onSave={() => setSaveMode('save')}
        onSaveAndAdd={() => setSaveMode('saveAndAdd')}
        onCancel={() => router.back()}
      />
    </form>
  );
}
