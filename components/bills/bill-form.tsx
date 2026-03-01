'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { AlertCircle, Plus, X, CreditCard, Landmark, Info, Sparkles, Check, ChevronDown, ChevronUp } from 'lucide-react';
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
import { MerchantSelector } from '@/components/transactions/merchant-selector';
import { BillFormActions } from './bill-form-actions';
import {
  suggestClassification,
  type ClassificationSuggestion,
  type BillClassification,
  CLASSIFICATION_META,
  formatSubcategory,
  getSubcategories
} from '@/lib/bills/bill-classification';
import type { CreateBillTemplateRequest, RecurrenceType } from '@/lib/bills/contracts';

// Bill classification options (matches database enum)
const CLASSIFICATION_OPTIONS = [
  { value: 'subscription', label: 'Subscription' },
  { value: 'utility', label: 'Utility' },
  { value: 'housing', label: 'Housing (Rent/Mortgage)' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'loan_payment', label: 'Loan Payment' },
  { value: 'membership', label: 'Membership' },
  { value: 'service', label: 'Service' },
  { value: 'other', label: 'Other' },
] as const;

// Tax deduction type options
const TAX_DEDUCTION_TYPE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'mortgage', label: 'Mortgage Interest' },
  { value: 'student_loan', label: 'Student Loan Interest' },
  { value: 'business', label: 'Business Expense' },
  { value: 'heloc_home', label: 'HELOC/Home Equity' },
] as const;

// Color options for debt bills
const DEBT_COLOR_DEFAULT_SENTINEL = '__default__';
const DEBT_COLOR_OPTIONS = [
  { value: '', label: 'Default' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
] as const;

interface SplitAllocation {
  periodNumber: number;
  percentage: number;
}

function createEqualSplitAllocations(periodCount: number): SplitAllocation[] {
  const safePeriodCount = Math.max(1, periodCount);
  const base = Number((100 / safePeriodCount).toFixed(2));
  const allocations: SplitAllocation[] = [];
  let runningTotal = 0;

  for (let periodNumber = 1; periodNumber <= safePeriodCount; periodNumber++) {
    const percentage = periodNumber === safePeriodCount
      ? Number((100 - runningTotal).toFixed(2))
      : base;
    runningTotal = Number((runningTotal + percentage).toFixed(2));
    allocations.push({ periodNumber, percentage });
  }

  return allocations;
}

function parseSplitAllocations(value: string | null | undefined): SplitAllocation[] {
  if (!value) {
    return createEqualSplitAllocations(2);
  }

  try {
    const parsed = JSON.parse(value) as Array<{ periodNumber?: number; percentage?: number }>;
    if (!Array.isArray(parsed)) {
      return createEqualSplitAllocations(2);
    }

    const valid = parsed
      .filter((entry) => Number.isFinite(entry?.periodNumber) && Number.isFinite(entry?.percentage))
      .map((entry) => ({
        periodNumber: Number(entry.periodNumber),
        percentage: Number(entry.percentage),
      }))
      .sort((a, b) => a.periodNumber - b.periodNumber);

    return valid.length > 0 ? valid : createEqualSplitAllocations(2);
  } catch {
    return createEqualSplitAllocations(2);
  }
}

function coerceSplitAllocations(raw: SplitAllocation[], periodCount: number): SplitAllocation[] {
  const safePeriodCount = Math.max(1, periodCount);
  const fallback = createEqualSplitAllocations(safePeriodCount);
  const rawMap = new Map(raw.map((entry) => [entry.periodNumber, entry.percentage]));

  return Array.from({ length: safePeriodCount }, (_, index) => {
    const periodNumber = index + 1;
    const value = rawMap.get(periodNumber);
    return {
      periodNumber,
      percentage: Number.isFinite(value) ? Number(value) : fallback[index].percentage,
    };
  });
}

function getPeriodAssignmentOptionLabel(
  periodNumber: number,
  frequency: string,
  periodsInMonth: number
): string {
  if (frequency === 'semi-monthly' && periodsInMonth === 2) {
    return periodNumber === 1
      ? 'Always First Half (1st-14th)'
      : 'Always Second Half (15th-end)';
  }

  if (frequency === 'weekly') {
    return `Always Week ${periodNumber}`;
  }

  if (frequency === 'biweekly') {
    return `Always Paycheck ${periodNumber}`;
  }

  return `Always Period ${periodNumber}`;
}

// Bill data structure for form
export interface BillData {
  id?: string;
  name: string;
  expectedAmount: number | string;
  dueDate?: number | null;
  specificDueDate?: string | null;
  startMonth?: number | null;
  frequency: string;
  isVariableAmount?: boolean;
  amountTolerance?: number;
  categoryId?: string | null;
  merchantId?: string | null;
  debtId?: string | null;
  accountId?: string | null;
  autoMarkPaid?: boolean;
  payeePatterns?: string | null;
  notes?: string | null;
  
  // Bill type and classification
  billType?: 'expense' | 'income' | 'savings_transfer';
  billClassification?: 'subscription' | 'utility' | 'housing' | 'insurance' | 'loan_payment' | 'membership' | 'service' | 'other';
  classificationSubcategory?: string | null;
  
  // Account linking
  linkedAccountId?: string | null;
  amountSource?: 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance';
  chargedToAccountId?: string | null;
  
  // Autopay configuration
  isAutopayEnabled?: boolean;
  autopayAccountId?: string | null;
  autopayAmountType?: 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance';
  autopayFixedAmount?: number | string;
  autopayDaysBefore?: number;
  
  // Debt extension fields
  isDebt?: boolean;
  originalBalance?: number | string;
  remainingBalance?: number | string;
  billInterestRate?: number | string;
  interestType?: 'fixed' | 'variable' | 'none';
  debtStartDate?: string | null;
  estimatedPayoffDate?: string | null;
  billColor?: string | null;
  
  // Payoff strategy
  includeInPayoffStrategy?: boolean;
  
  // Tax deduction settings
  isInterestTaxDeductible?: boolean;
  taxDeductionType?: 'mortgage' | 'student_loan' | 'business' | 'heloc_home' | 'none';
  taxDeductionLimit?: number | string;
  
  // Budget period assignment (for bill pay feature)
  budgetPeriodAssignment?: number | null;
  
  // Split payment across periods (for partial payment budgeting)
  splitAcrossPeriods?: boolean;
  splitAllocations?: string | null; // JSON of [{periodNumber: 1, percentage: 50}, ...]
  
  [key: string]: unknown; // Allow additional properties
}

export type BillTemplateUpsertPayload = CreateBillTemplateRequest & {
  autopay?: {
    isEnabled: boolean;
    payFromAccountId: string | null;
    amountType: 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance';
    fixedAmountCents: number | null;
    daysBeforeDue: number;
  } | null;
};

// Account type for filtering credit/line of credit accounts
interface Account {
  id: string;
  name: string;
  type?: string;
  creditLimit?: number;
  interestRate?: number;
}

interface BillFormProps {
  bill?: BillData;
  onSubmit: (data: BillTemplateUpsertPayload, saveMode?: 'save' | 'saveAndAdd') => void;
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: bill?.name || '',
    expectedAmount: bill?.expectedAmount || '',
    dueDate: bill?.dueDate !== undefined ? String(bill.dueDate) : '1',
    specificDueDate: bill?.specificDueDate || '',
    startMonth: bill?.startMonth !== undefined && bill?.startMonth !== null 
      ? String(bill.startMonth) 
      : String(new Date().getMonth()), // Default to current month
    frequency: bill?.frequency || 'monthly',
    isVariableAmount: bill?.isVariableAmount || false,
    amountTolerance: bill?.amountTolerance || 5.0,
    categoryId: bill?.categoryId || '',
    merchantId: bill?.merchantId || '',
    debtId: bill?.debtId || '',
    accountId: bill?.accountId || '',
    autoMarkPaid: bill?.autoMarkPaid !== undefined ? bill.autoMarkPaid : true,
    payeePatterns: bill?.payeePatterns ? JSON.parse(bill.payeePatterns as string) : [],
    notes: bill?.notes || '',
    
    // Bill classification
    billType: bill?.billType || 'expense',
    billClassification: bill?.billClassification || 'other',
    classificationSubcategory: bill?.classificationSubcategory || null,

    // Account linking
    linkedAccountId: bill?.linkedAccountId || '',
    amountSource: bill?.amountSource || 'fixed',
    chargedToAccountId: bill?.chargedToAccountId || '',
    
    // Autopay
    isAutopayEnabled: bill?.isAutopayEnabled || false,
    autopayAccountId: bill?.autopayAccountId || '',
    autopayAmountType: bill?.autopayAmountType || 'fixed',
    autopayFixedAmount: bill?.autopayFixedAmount || '',
    autopayDaysBefore: bill?.autopayDaysBefore || 0,
    
    // Debt extension
    isDebt: bill?.isDebt || false,
    originalBalance: bill?.originalBalance || '',
    remainingBalance: bill?.remainingBalance || '',
    billInterestRate: bill?.billInterestRate || '',
    interestType: bill?.interestType || 'fixed',
    debtStartDate: bill?.debtStartDate || '',
    billColor: bill?.billColor || '',
    
    // Payoff strategy
    includeInPayoffStrategy: bill?.includeInPayoffStrategy ?? true,
    
    // Tax deduction
    isInterestTaxDeductible: bill?.isInterestTaxDeductible || false,
    taxDeductionType: bill?.taxDeductionType || 'none',
    taxDeductionLimit: bill?.taxDeductionLimit || '',
    
    // Budget period assignment
    budgetPeriodAssignment: bill?.budgetPeriodAssignment !== undefined && bill?.budgetPeriodAssignment !== null
      ? String(bill.budgetPeriodAssignment)
      : 'auto',
    
    // Split payment across periods
    splitAcrossPeriods: bill?.splitAcrossPeriods || false,
    splitAllocations: parseSplitAllocations(bill?.splitAllocations),
  });

  // Collapsible sections state - auto-expand sections with existing data when editing
  const [showCategorization, setShowCategorization] = useState(
    !!(bill?.categoryId || bill?.merchantId || bill?.billClassification !== 'other')
  );
  const [showPaymentSettings, setShowPaymentSettings] = useState(
    !!(bill?.accountId || bill?.linkedAccountId || bill?.chargedToAccountId || bill?.isAutopayEnabled)
  );
  const [showDebtSection, setShowDebtSection] = useState(bill?.isDebt || false);
  const [showAdvanced, setShowAdvanced] = useState(
    !!(bill?.payeePatterns || bill?.notes || bill?.budgetPeriodAssignment || bill?.splitAcrossPeriods)
  );
  
  // Classification suggestion state
  const [classificationSuggestion, setClassificationSuggestion] = useState<ClassificationSuggestion | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  const [categories, setCategories] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Array<{ id: string; name: string; remainingBalance?: number }>>([]);
  const [newPayeePattern, setNewPayeePattern] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  
  // Budget schedule state for dynamic period options
  const [budgetSchedule, setBudgetSchedule] = useState<{
    frequency: string;
    periodsInMonth: number;
  } | null>(null);
  
  // Filter accounts to get only credit cards and lines of credit
  const creditAccounts = accounts.filter(a => a.type === 'credit' || a.type === 'line_of_credit');

  // Auto-suggest classification based on bill name (debounced)
  useEffect(() => {
    // Only suggest if not editing existing bill and classification hasn't been manually set
    if (bill?.id || suggestionDismissed) {
      return;
    }
    
    const timer = setTimeout(() => {
      if (formData.name.length >= 3 && formData.billClassification === 'other') {
        const suggestion = suggestClassification(formData.name);
        setClassificationSuggestion(suggestion);
      } else {
        setClassificationSuggestion(null);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [formData.name, formData.billClassification, bill?.id, suggestionDismissed]);

  // Apply suggested classification
  const applySuggestion = useCallback(() => {
    if (classificationSuggestion) {
      setFormData(prev => ({
        ...prev,
        billClassification: classificationSuggestion.classification,
        classificationSubcategory: classificationSuggestion.subcategory,
      }));
      setClassificationSuggestion(null);
      const subcategoryText = classificationSuggestion.subcategory
        ? ` (${formatSubcategory(classificationSuggestion.subcategory)})`
        : '';
      toast.success(`Classification set to ${CLASSIFICATION_META[classificationSuggestion.classification].label}${subcategoryText}`);
    }
  }, [classificationSuggestion]);

  // Dismiss suggestion
  const dismissSuggestion = useCallback(() => {
    setClassificationSuggestion(null);
    setSuggestionDismissed(true);
  }, []);

  // Fetch categories, accounts, and debts on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedHouseholdId) return;

      try {
        // MerchantSelector handles its own fetching, so we don't need to fetch merchants here
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

  // Fetch budget schedule settings for dynamic period options
  useEffect(() => {
    const fetchBudgetSchedule = async () => {
      if (!selectedHouseholdId) return;
      try {
        const response = await fetchWithHousehold(`/api/budget-schedule?householdId=${selectedHouseholdId}`);
        if (response.ok) {
          const data = await response.json();
          setBudgetSchedule({
            frequency: data.settings.budgetCycleFrequency,
            periodsInMonth: data.currentPeriod.periodsInMonth,
          });
        }
      } catch (error) {
        console.error('Failed to fetch budget schedule:', error);
        // Default to showing all options if fetch fails
        setBudgetSchedule({ frequency: 'weekly', periodsInMonth: 4 });
      }
    };
    fetchBudgetSchedule();
  }, [selectedHouseholdId, fetchWithHousehold]);

  // Reset budget period assignment if it's invalid for the current schedule
  useEffect(() => {
    if (!budgetSchedule) return;
    
    const currentAssignment = formData.budgetPeriodAssignment;
    // If assignment is 'auto' or empty, it's always valid
    if (currentAssignment === 'auto' || !currentAssignment) return;
    
    // Check if the numeric assignment exceeds available periods
    const assignmentNum = parseInt(currentAssignment, 10);
    if (!isNaN(assignmentNum) && assignmentNum > budgetSchedule.periodsInMonth) {
      // Reset to automatic since the selected period no longer exists
      setFormData(prev => ({ ...prev, budgetPeriodAssignment: 'auto' }));
      toast.info('Budget period assignment reset to Automatic (schedule changed)');
    }
  }, [budgetSchedule, formData.budgetPeriodAssignment]);

  // Keep split allocation shape aligned with the current period count
  useEffect(() => {
    if (!budgetSchedule || !formData.splitAcrossPeriods) return;

    const normalized = coerceSplitAllocations(
      formData.splitAllocations as SplitAllocation[],
      budgetSchedule.periodsInMonth
    );

    const currentSerialized = JSON.stringify(formData.splitAllocations);
    const nextSerialized = JSON.stringify(normalized);
    if (currentSerialized !== nextSerialized) {
      setFormData(prev => ({
        ...prev,
        splitAllocations: normalized,
      }));
    }
  }, [budgetSchedule, formData.splitAcrossPeriods, formData.splitAllocations]);

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

    if (!selectedHouseholdId) {
      toast.error('Please select a household first');
      return;
    }

    setCreatingCategory(true);
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-household-id': selectedHouseholdId,
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newCategoryName,
          type: 'expense',
          monthlyBudget: 0,
          householdId: selectedHouseholdId,
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
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to create category');
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

    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Bill name is required';
    }

    if (!formData.expectedAmount || parseFloat(String(formData.expectedAmount)) <= 0) {
      newErrors.expectedAmount = 'Expected amount must be greater than 0';
    }

    // Frequency-specific validation
    if (isOneTimeFrequency(formData.frequency)) {
      if (!formData.specificDueDate) {
        newErrors.specificDueDate = 'Due date is required for one-time bills';
      } else {
        // Validate date is not in the past
        const selectedDate = parseISO(formData.specificDueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          newErrors.specificDueDate = 'Due date cannot be in the past';
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
        newErrors.dueDate = 'Due date must be between 1 and 31';
      }
    }

    // Debt-specific validation
    if (formData.isDebt) {
      if (!formData.originalBalance || parseFloat(String(formData.originalBalance)) <= 0) {
        newErrors.originalBalance = 'Original balance is required for debt bills';
      }
    }

    // Autopay validation
    if (formData.isAutopayEnabled) {
      if (!formData.autopayAccountId) {
        newErrors.autopayAccountId = 'Source account is required for autopay';
      }
    }

    // Validate linkedAccountId and chargedToAccountId are mutually exclusive
    if (formData.linkedAccountId && formData.chargedToAccountId) {
      newErrors.linkedAccountId = 'Cannot be both a payment to a card and charged to a card';
    }

    if (formData.splitAcrossPeriods) {
      const periodCount = Math.max(1, budgetSchedule?.periodsInMonth ?? 2);
      const normalizedAllocations = coerceSplitAllocations(
        formData.splitAllocations as SplitAllocation[],
        periodCount
      );
      const totalPercentage = normalizedAllocations.reduce((sum, allocation) => sum + allocation.percentage, 0);

      if (normalizedAllocations.some((allocation) => allocation.percentage < 0 || allocation.percentage > 100)) {
        newErrors.splitAllocations = 'Each split percentage must be between 0 and 100';
      } else if (Math.abs(totalPercentage - 100) > 0.01) {
        newErrors.splitAllocations = 'Split percentages must add up to 100%';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSaveMode(null);
      toast.error(Object.values(newErrors)[0]);
      return;
    }

    setErrors({});

    const recurrenceType: RecurrenceType = (() => {
      switch (formData.frequency) {
        case 'one-time':
          return 'one_time';
        case 'semi-annual':
          return 'semi_annual';
        default:
          return formData.frequency as RecurrenceType;
      }
    })();

    const dueDateNumber = isOneTimeFrequency(formData.frequency) ? null : parseInt(formData.dueDate);
    const expectedAmountCents = Math.round(parseFloat(String(formData.expectedAmount)) * 100);
    const autopayAmountType = formData.autopayAmountType as 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance';

    onSubmit(
      {
        name: formData.name,
        billType: formData.billType as 'expense' | 'income' | 'savings_transfer',
        classification: formData.billClassification as CreateBillTemplateRequest['classification'],
        classificationSubcategory: formData.classificationSubcategory || null,
        recurrenceType,
        recurrenceDueDay:
          recurrenceType !== 'one_time' && recurrenceType !== 'weekly' && recurrenceType !== 'biweekly'
            ? dueDateNumber
            : null,
        recurrenceDueWeekday:
          recurrenceType === 'weekly' || recurrenceType === 'biweekly' ? dueDateNumber : null,
        recurrenceSpecificDueDate:
          recurrenceType === 'one_time' ? formData.specificDueDate || null : null,
        recurrenceStartMonth:
          isNonMonthlyPeriodic(formData.frequency) ? parseInt(formData.startMonth) : null,
        defaultAmountCents: expectedAmountCents,
        isVariableAmount: formData.isVariableAmount,
        amountToleranceBps: Math.round((parseFloat(String(formData.amountTolerance)) || 5.0) * 100),
        categoryId: formData.categoryId || null,
        merchantId: formData.merchantId || null,
        paymentAccountId: formData.accountId || null,
        linkedLiabilityAccountId: formData.linkedAccountId || null,
        chargedToAccountId: formData.chargedToAccountId || null,
        autoMarkPaid: formData.autoMarkPaid,
        notes: formData.notes || null,
        debtEnabled: formData.isDebt,
        debtOriginalBalanceCents:
          formData.isDebt && formData.originalBalance
            ? Math.round(parseFloat(String(formData.originalBalance)) * 100)
            : null,
        debtRemainingBalanceCents:
          formData.isDebt && formData.remainingBalance
            ? Math.round(parseFloat(String(formData.remainingBalance)) * 100)
            : formData.isDebt && formData.originalBalance
              ? Math.round(parseFloat(String(formData.originalBalance)) * 100)
              : null,
        debtInterestAprBps:
          formData.isDebt && formData.billInterestRate
            ? Math.round(parseFloat(String(formData.billInterestRate)) * 100)
            : null,
        debtInterestType: formData.isDebt ? formData.interestType : null,
        debtStartDate: formData.isDebt && formData.debtStartDate ? formData.debtStartDate : null,
        debtColor: formData.isDebt && formData.billColor ? formData.billColor : null,
        includeInPayoffStrategy: formData.isDebt ? formData.includeInPayoffStrategy : true,
        interestTaxDeductible: formData.isDebt ? formData.isInterestTaxDeductible : false,
        interestTaxDeductionType:
          formData.isDebt && formData.isInterestTaxDeductible
            ? (formData.taxDeductionType as CreateBillTemplateRequest['interestTaxDeductionType'])
            : 'none',
        interestTaxDeductionLimitCents:
          formData.isDebt && formData.isInterestTaxDeductible && formData.taxDeductionLimit
            ? Math.round(parseFloat(String(formData.taxDeductionLimit)) * 100)
            : null,
        budgetPeriodAssignment:
          formData.budgetPeriodAssignment && formData.budgetPeriodAssignment !== 'auto'
            ? parseInt(formData.budgetPeriodAssignment)
            : null,
        splitAcrossPeriods: formData.splitAcrossPeriods,
        autopay: formData.isAutopayEnabled
          ? {
              isEnabled: true,
              payFromAccountId: formData.autopayAccountId || null,
              amountType: autopayAmountType,
              fixedAmountCents:
                autopayAmountType === 'fixed' && formData.autopayFixedAmount
                  ? Math.round(parseFloat(String(formData.autopayFixedAmount)) * 100)
                  : autopayAmountType === 'fixed'
                    ? expectedAmountCents
                    : null,
              daysBeforeDue: formData.autopayDaysBefore || 0,
            }
          : null,
      },
      saveMode || 'save'
    );

    // If save & add another, reset form
    if (saveMode === 'saveAndAdd') {
      const preservedFrequency = formData.frequency;
      const preservedStartMonth = formData.startMonth;
      setFormData({
        name: '',
        expectedAmount: '',
        dueDate: '1',
        specificDueDate: '',
        startMonth: preservedStartMonth, // Preserve start month for convenience
        frequency: preservedFrequency,
        isVariableAmount: false,
        amountTolerance: 5.0,
        categoryId: '',
        merchantId: '',
        debtId: '',
        accountId: '',
        autoMarkPaid: true,
        payeePatterns: [],
        notes: '',
        billType: 'expense',
        billClassification: 'other',
        classificationSubcategory: null,
        linkedAccountId: '',
        amountSource: 'fixed',
        chargedToAccountId: '',
        isAutopayEnabled: false,
        autopayAccountId: '',
        autopayAmountType: 'fixed',
        autopayFixedAmount: '',
        autopayDaysBefore: 0,
        isDebt: false,
        originalBalance: '',
        remainingBalance: '',
        billInterestRate: '',
        interestType: 'fixed',
        debtStartDate: '',
        billColor: '',
        includeInPayoffStrategy: true,
        isInterestTaxDeductible: false,
        taxDeductionType: 'none',
        taxDeductionLimit: '',
        budgetPeriodAssignment: 'auto',
        splitAcrossPeriods: false,
        splitAllocations: createEqualSplitAllocations(Math.max(1, budgetSchedule?.periodsInMonth ?? 2)),
      });
      setNewPayeePattern('');
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setSaveMode(null);
      setShowCategorization(false);
      setShowPaymentSettings(false);
      setShowDebtSection(false);
      setShowAdvanced(false);

      // Focus on name field for quick data entry
      setTimeout(() => {
        document.getElementById('bill-name')?.focus();
      }, 100);
    }
  };

  const currentPeriodCount = Math.max(1, budgetSchedule?.periodsInMonth ?? 2);
  const splitAllocationsForSchedule = coerceSplitAllocations(
    formData.splitAllocations as SplitAllocation[],
    currentPeriodCount
  );
  const splitAllocationTotal = splitAllocationsForSchedule.reduce(
    (sum, allocation) => sum + allocation.percentage,
    0
  );

  const _fs = { backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' };
  const _lbl = 'text-[11px] font-medium uppercase tracking-wide block mb-1.5';
  const _lblS = { color: 'var(--color-muted-foreground)' };
  const _errS = { color: 'var(--color-destructive)' };
  const _hint = 'text-[11px] mt-1';
  const _hintS = { color: 'var(--color-muted-foreground)', opacity: 0.75 };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name and Amount */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className={_lbl} style={errors.name ? _errS : _lblS}>Bill Name*</Label>
          <Input
            id="bill-name"
            name="name"
            value={formData.name}
            onChange={(e) => { handleChange(e); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }}
            placeholder="e.g., Electric Bill, Netflix"
            className="h-9 text-[13px]"
            style={{ ..._fs, borderColor: errors.name ? 'var(--color-destructive)' : 'var(--color-border)' }}
          />
          {errors.name && <p className={_hint} style={_errS}>{errors.name}</p>}
          {classificationSuggestion && classificationSuggestion.confidence >= 0.7 && (
            <div className="mt-1.5 px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2" style={{ backgroundColor: `${CLASSIFICATION_META[classificationSuggestion.classification].color}12`, border: `1px solid ${CLASSIFICATION_META[classificationSuggestion.classification].color}30` }}>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 shrink-0" style={{ color: CLASSIFICATION_META[classificationSuggestion.classification].color }} />
                <span className="text-[11px]" style={{ color: CLASSIFICATION_META[classificationSuggestion.classification].color }}>
                  Suggested: <strong>{CLASSIFICATION_META[classificationSuggestion.classification].label}</strong>
                  {classificationSuggestion.subcategory && <span className="opacity-70"> · {formatSubcategory(classificationSuggestion.subcategory)}</span>}
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                <Button type="button" size="sm" onClick={applySuggestion} className="h-6 px-2 text-[10px]" style={{ backgroundColor: CLASSIFICATION_META[classificationSuggestion.classification].color, color: 'white' }}><Check className="w-2.5 h-2.5 mr-0.5" />Apply</Button>
                <Button type="button" size="sm" variant="ghost" onClick={dismissSuggestion} className="h-6 w-6 p-0" style={{ color: 'var(--color-muted-foreground)' }}><X className="w-3 h-3" /></Button>
              </div>
            </div>
          )}
        </div>
        <div>
          <Label className={_lbl} style={errors.expectedAmount ? _errS : _lblS}>Expected Amount*</Label>
          <Input
            name="expectedAmount"
            type="number"
            value={formData.expectedAmount}
            onChange={(e) => { handleChange(e); if (errors.expectedAmount) setErrors(prev => ({ ...prev, expectedAmount: '' })); }}
            placeholder="0.00"
            step="0.01"
            className="h-9 text-[13px] tabular-nums"
            style={{ ..._fs, borderColor: errors.expectedAmount ? 'var(--color-destructive)' : 'var(--color-border)' }}
          />
          {errors.expectedAmount && <p className={_hint} style={_errS}>{errors.expectedAmount}</p>}
        </div>
      </div>

      {/* Frequency and Due Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className={_lbl} style={_lblS}>Frequency*</Label>
          <Select value={formData.frequency} onValueChange={v => handleSelectChange('frequency', v)}>
            <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue /></SelectTrigger>
            <SelectContent>
              {['one-time','weekly','biweekly','monthly','quarterly','semi-annual','annual'].map(f => (
                <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f as keyof typeof FREQUENCY_LABELS]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={_lbl} style={_lblS}>{getDueDateLabel(formData.frequency)}*</Label>
          {isOneTimeFrequency(formData.frequency) ? (
            <>
              <Input name="specificDueDate" type="date" value={formData.specificDueDate} onChange={handleChange} className="h-9 text-[13px]" style={_fs} required />
              <p className={_hint} style={_hintS}>Select the specific date for this bill</p>
            </>
          ) : isWeekBasedFrequency(formData.frequency) ? (
            <>
              <Select value={formData.dueDate} onValueChange={v => handleSelectChange('dueDate', v)}>
                <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue placeholder="Select day of week" /></SelectTrigger>
                <SelectContent>{DAY_OF_WEEK_OPTIONS.map(d => <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className={_hint} style={_hintS}>Day of week for recurring bill</p>
            </>
          ) : (
            <>
              <Input name="dueDate" type="number" value={formData.dueDate} onChange={handleChange} placeholder="1" min="1" max="31" className="h-9 text-[13px]" style={_fs} />
              <p className={_hint} style={_hintS}>Day of month (1–31)</p>
            </>
          )}
        </div>
      </div>

      {/* Start Month */}
      {isNonMonthlyPeriodic(formData.frequency) && (
        <div>
          <Label className={_lbl} style={_lblS}>Start Month*</Label>
          <Select value={formData.startMonth} onValueChange={v => handleSelectChange('startMonth', v)}>
            <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue placeholder="Select month" /></SelectTrigger>
            <SelectContent>{MONTH_OPTIONS.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <p className={_hint} style={_hintS}>The month when your first bill is due</p>
        </div>
      )}

      {/* ========== CATEGORIZATION SECTION (Collapsible) ========== */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <button type="button" onClick={() => setShowCategorization(!showCategorization)}
          className="w-full flex items-center justify-between px-4 py-3 transition-colors"
          style={{ backgroundColor: showCategorization ? 'var(--color-elevated)' : 'var(--color-background)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Categorization</span>
            {(formData.categoryId || formData.merchantId || formData.billClassification !== 'other') && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>
                {[formData.categoryId && 'Category', formData.merchantId && 'Merchant', formData.billClassification !== 'other' && 'Classification'].filter(Boolean).join(', ')}
              </span>
            )}
          </div>
          {showCategorization ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />}
        </button>

        {showCategorization && (
          <div className="px-4 py-4 space-y-4" style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            {/* Category and Merchant */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className={_lbl} style={_lblS}>Category</Label>
                {!isCreatingCategory ? (
                  <div className="flex gap-2">
                    <Select value={formData.categoryId} onValueChange={v => handleSelectChange('categoryId', v)}>
                      <SelectTrigger className="flex-1 h-9 text-[13px]" style={_fs}><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => setIsCreatingCategory(true)} className="h-9 w-9 shrink-0">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input autoFocus type="text" placeholder="New category name..." value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={handleCategoryKeyDown} className="flex-1 h-9 text-[13px]" style={{ ..._fs, borderColor: 'var(--color-primary)' }} />
                    <Button type="button" size="icon" onClick={handleCreateCategory} disabled={creatingCategory || !newCategoryName.trim()} className="h-9 w-9 shrink-0" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}><Plus className="w-4 h-4" /></Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => { setIsCreatingCategory(false); setNewCategoryName(''); }} className="h-9 w-9 shrink-0"><X className="w-4 h-4" /></Button>
                  </div>
                )}
              </div>
              <div>
                <MerchantSelector selectedMerchant={formData.merchantId || null} onMerchantChange={merchantId => handleSelectChange('merchantId', merchantId || '')} />
              </div>
            </div>

            {/* Classification */}
            <div>
              <Label className={_lbl} style={_lblS}>Classification</Label>
              <Select value={formData.billClassification} onValueChange={v => { handleSelectChange('billClassification', v); setFormData(prev => ({ ...prev, classificationSubcategory: null })); }}>
                <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue placeholder="Select classification" /></SelectTrigger>
                <SelectContent>{CLASSIFICATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Subcategory */}
            {getSubcategories(formData.billClassification as BillClassification).length > 0 && (
              <div>
                <Label className={_lbl} style={_lblS}>Subcategory</Label>
                <Select value={formData.classificationSubcategory || 'none'} onValueChange={v => handleSelectChange('classificationSubcategory', v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue placeholder="Select subcategory" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {getSubcategories(formData.billClassification as BillClassification).map(s => <SelectItem key={s} value={s}>{formatSubcategory(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========== PAYMENT SETTINGS SECTION (Collapsible) ========== */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <button type="button" onClick={() => setShowPaymentSettings(!showPaymentSettings)}
          className="w-full flex items-center justify-between px-4 py-3 transition-colors"
          style={{ backgroundColor: showPaymentSettings ? 'var(--color-elevated)' : 'var(--color-background)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Payment Settings</span>
            {(formData.accountId || formData.linkedAccountId || formData.chargedToAccountId || formData.isAutopayEnabled) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>Configured</span>
            )}
          </div>
          {showPaymentSettings ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />}
        </button>

        {showPaymentSettings && (
          <div className="px-4 py-4 space-y-4" style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            {/* Payment Account */}
            <div>
              <Label className={_lbl} style={_lblS}>Payment Account</Label>
              <Select value={formData.accountId} onValueChange={v => handleSelectChange('accountId', v)}>
                <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
              <p className={_hint} style={_hintS}>The account used to pay this bill</p>
            </div>

            {/* Link to Debt */}
            <div>
              <Label className={_lbl} style={_lblS}>Link to Debt</Label>
              <Select value={formData.debtId || 'none'} onValueChange={v => handleSelectChange('debtId', v === 'none' ? '' : v)}>
                <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue placeholder="Select debt (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {debts.map(d => <SelectItem key={d.id} value={d.id}>{d.name} · ${d.remainingBalance?.toFixed(2)}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className={_hint} style={_hintS}>Payments will reduce the debt balance</p>
            </div>
          </div>
        )}
      </div>

      {/* Basic Toggles */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
        <div className="flex items-center justify-between px-3 py-3" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
          <div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Variable Amount</p>
            <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Amount varies each month</p>
          </div>
          <button type="button" onClick={() => handleCheckboxChange('isVariableAmount')}
            className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
            style={{ backgroundColor: formData.isVariableAmount ? 'var(--color-primary)' : 'var(--color-border)' }}>
            <span className="inline-block h-3.5 w-3.5 transform rounded-full transition-transform" style={{ backgroundColor: 'var(--color-background)', transform: `translateX(${formData.isVariableAmount ? '18px' : '2px'})` }} />
          </button>
        </div>
        <div className="flex items-center justify-between px-3 py-3">
          <div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Auto-mark Paid</p>
            <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Automatically mark as paid when a matching transaction is created</p>
          </div>
          <button type="button" onClick={() => handleCheckboxChange('autoMarkPaid')}
            className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
            style={{ backgroundColor: formData.autoMarkPaid ? 'var(--color-primary)' : 'var(--color-border)' }}>
            <span className="inline-block h-3.5 w-3.5 transform rounded-full transition-transform" style={{ backgroundColor: 'var(--color-background)', transform: `translateX(${formData.autoMarkPaid ? '18px' : '2px'})` }} />
          </button>
        </div>
      </div>

      {/* Budget Period Assignment */}
      {budgetSchedule && budgetSchedule.periodsInMonth > 1 && (
        <div className="rounded-xl px-4 py-4 space-y-3" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <div>
            <Label className={_lbl} style={_lblS}>Budget Period Assignment (Optional)</Label>
            <Select value={formData.budgetPeriodAssignment} onValueChange={v => handleSelectChange('budgetPeriodAssignment', v)}>
              <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue placeholder="Automatic (based on due date)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatic (based on due date)</SelectItem>
                {Array.from({ length: budgetSchedule.periodsInMonth }, (_, i) => {
                  const n = i + 1;
                  return <SelectItem key={n} value={String(n)}>{getPeriodAssignmentOptionLabel(n, budgetSchedule.frequency, budgetSchedule.periodsInMonth)}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <p className={_hint} style={_hintS}>Override which budget period this bill appears in. Useful to pay a bill before its due date.</p>
          </div>

          {/* Split Payment Option */}
          <div className="pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <input
                type="checkbox"
                id="splitAcrossPeriods"
                checked={formData.splitAcrossPeriods}
                onChange={() => handleCheckboxChange('splitAcrossPeriods')}
                className="h-4 w-4 rounded border"
            style={{ borderColor: 'var(--color-border)' }}
              />
              <Label htmlFor="splitAcrossPeriods" className="text-[13px] cursor-pointer" style={{ color: 'var(--color-foreground)' }}>
                Split payment across budget periods
              </Label>
            </div>
            <p className={_hint + ' mb-2'} style={_hintS}>Pay part of this bill in each budget period</p>
            {formData.splitAcrossPeriods && (
              <div className="space-y-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                <p className={_hint} style={_hintS}>Set the percentage to pay in each period:</p>
                <div className={`grid gap-2 ${budgetSchedule.periodsInMonth <= 2 ? 'grid-cols-2' : budgetSchedule.periodsInMonth <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
                  {splitAllocationsForSchedule.map(allocation => (
                    <div key={allocation.periodNumber}>
                      <Label className="text-[10px] uppercase tracking-wide block mb-1" style={_lblS}>
                        {getPeriodAssignmentOptionLabel(allocation.periodNumber, budgetSchedule.frequency, budgetSchedule.periodsInMonth).replace('Always ', '')}
                      </Label>
                      <div className="flex items-center gap-1">
                        <Input type="number" min="0" max="100" value={allocation.percentage}
                          onChange={e => {
                            const v = Number(e.target.value);
                            setFormData(prev => ({ ...prev, splitAllocations: coerceSplitAllocations((prev.splitAllocations as SplitAllocation[]).map(entry => entry.periodNumber === allocation.periodNumber ? { ...entry, percentage: Number.isFinite(v) ? v : 0 } : entry), budgetSchedule.periodsInMonth) }));
                          }}
                          className="w-16 h-8 text-right text-[12px]" style={_fs} />
                        <span className="text-[11px]" style={_lblS}>%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px]" style={{ color: Math.abs(splitAllocationTotal - 100) > 0.01 ? 'var(--color-warning)' : 'var(--color-muted-foreground)' }}>
                  Total: {splitAllocationTotal.toFixed(2)}%
                </p>
                {errors.splitAllocations && <p className="text-[11px]" style={{ color: 'var(--color-destructive)' }}>{errors.splitAllocations}</p>}
                {formData.expectedAmount && (
                  <p className="text-[11px]" style={_hintS}>Preview: {splitAllocationsForSchedule.map(a => `P${a.periodNumber}: $${((parseFloat(String(formData.expectedAmount)) || 0) * a.percentage / 100).toFixed(2)}`).join(' · ')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Credit Card Linking */}
      {creditAccounts.length > 0 && (
        <div className="rounded-xl px-4 py-4 space-y-4" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard className="w-3.5 h-3.5" style={_lblS} />
              <Label className={_lbl} style={_lblS}>Linked Credit Card/LOC (Optional)</Label>
            </div>
            <p className={_hint + ' mb-2'} style={_hintS}>For bills that represent payments to a credit account</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select value={formData.linkedAccountId || 'none'} onValueChange={v => { handleSelectChange('linkedAccountId', v === 'none' ? '' : v); if (v !== 'none') handleSelectChange('chargedToAccountId', ''); }}>
                <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {creditAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {formData.linkedAccountId && (
                <Select value={formData.amountSource} onValueChange={v => handleSelectChange('amountSource', v)}>
                  <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue placeholder="Payment amount" /></SelectTrigger>
                  <SelectContent><SelectItem value="fixed">Fixed Amount</SelectItem><SelectItem value="minimum_payment">Minimum Payment</SelectItem><SelectItem value="statement_balance">Statement Balance</SelectItem><SelectItem value="full_balance">Full Balance</SelectItem></SelectContent>
                </Select>
              )}
            </div>
            {formData.linkedAccountId && (
              <div className="mt-2 flex items-start gap-2 px-2.5 py-2 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
                <p className="text-[11px]" style={{ color: 'var(--color-primary)' }}>Payments to this bill will reduce the credit card balance</p>
              </div>
            )}
          </div>

          {!formData.linkedAccountId && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Landmark className="w-3.5 h-3.5" style={_lblS} />
                <Label className={_lbl} style={_lblS}>Charged to Credit Card (Optional)</Label>
              </div>
              <p className={_hint + ' mb-2'} style={_hintS}>This bill is automatically charged to a credit card</p>
              <Select value={formData.chargedToAccountId || 'none'} onValueChange={v => handleSelectChange('chargedToAccountId', v === 'none' ? '' : v)}>
                <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {creditAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {formData.chargedToAccountId && (
                <div className="mt-2 flex items-start gap-2 px-2.5 py-2 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 20%, transparent)' }}>
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
                  <p className="text-[11px]" style={{ color: 'var(--color-warning)' }}>When due, expense will be created on the selected card</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Autopay Configuration */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
        <div className="flex items-center justify-between px-3 py-3">
          <div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Autopay</p>
            <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Automatically create payment transactions when due</p>
          </div>
          <button type="button" onClick={() => handleCheckboxChange('isAutopayEnabled')}
            className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
            style={{ backgroundColor: formData.isAutopayEnabled ? 'var(--color-income)' : 'var(--color-border)' }}>
            <span className="inline-block h-3.5 w-3.5 transform rounded-full transition-transform" style={{ backgroundColor: 'var(--color-background)', transform: `translateX(${formData.isAutopayEnabled ? '18px' : '2px'})` }} />
          </button>
        </div>

        {formData.isAutopayEnabled && (
          <div className="px-3 pb-3 space-y-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
              <div>
                <Label className={_lbl} style={_lblS}>Pay From Account*</Label>
                <Select value={formData.autopayAccountId || 'none'} onValueChange={v => handleSelectChange('autopayAccountId', v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select account…</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={_lbl} style={_lblS}>Amount</Label>
                <Select value={formData.autopayAmountType} onValueChange={v => handleSelectChange('autopayAmountType', v)}>
                  <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue placeholder="Amount type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    {formData.linkedAccountId && (<><SelectItem value="minimum_payment">Minimum Payment</SelectItem><SelectItem value="statement_balance">Statement Balance</SelectItem><SelectItem value="full_balance">Full Balance</SelectItem></>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.autopayAmountType === 'fixed' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className={_lbl} style={_lblS}>Fixed Amount</Label>
                  <Input name="autopayFixedAmount" type="number" value={formData.autopayFixedAmount} onChange={handleChange} placeholder="0.00" step="0.01" className="h-9 text-[13px]" style={_fs} />
                </div>
                <div>
                  <Label className={_lbl} style={_lblS}>Days Before Due</Label>
                  <Select value={String(formData.autopayDaysBefore)} onValueChange={v => handleSelectChange('autopayDaysBefore', v)}>
                    <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue /></SelectTrigger>
                    <SelectContent>{[0,1,2,3,5,7,14].map(d => <SelectItem key={d} value={String(d)}>{d === 0 ? 'On due date' : `${d} day${d > 1 ? 's' : ''} before`}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 20%, transparent)' }}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
              <p className="text-[11px]" style={{ color: 'var(--color-warning)' }}>Autopay will create transactions automatically. Ensure sufficient funds are available.</p>
            </div>
          </div>
        )}
      </div>

      {/* Debt Configuration */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
        <div className="flex items-center justify-between px-3 py-3 cursor-pointer" onClick={() => { setShowDebtSection(!showDebtSection); if (!showDebtSection && !formData.isDebt) handleCheckboxChange('isDebt'); }}>
          <div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>This is a debt</p>
            <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Track principal balance, interest, and payoff progress</p>
          </div>
          <button type="button" onClick={e => { e.stopPropagation(); setShowDebtSection(!formData.isDebt); handleCheckboxChange('isDebt'); }}
            className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
            style={{ backgroundColor: formData.isDebt ? 'var(--color-primary)' : 'var(--color-border)' }}>
            <span className="inline-block h-3.5 w-3.5 transform rounded-full transition-transform" style={{ backgroundColor: 'var(--color-background)', transform: `translateX(${formData.isDebt ? '18px' : '2px'})` }} />
          </button>
        </div>

        {formData.isDebt && (
          <div className="px-3 pb-3 space-y-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
              <div>
                <Label className={_lbl} style={_lblS}>Original Balance*</Label>
                <Input name="originalBalance" type="number" value={formData.originalBalance} onChange={handleChange} placeholder="0.00" step="0.01" className="h-9 text-[13px] tabular-nums" style={_fs} />
              </div>
              <div>
                <Label className={_lbl} style={_lblS}>Remaining Balance</Label>
                <Input name="remainingBalance" type="number" value={formData.remainingBalance} onChange={handleChange} placeholder="Same as original" step="0.01" className="h-9 text-[13px] tabular-nums" style={_fs} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className={_lbl} style={_lblS}>Interest Rate (APR %)</Label>
                <Input name="billInterestRate" type="number" value={formData.billInterestRate} onChange={handleChange} placeholder="0.00" step="0.01" className="h-9 text-[13px] tabular-nums" style={_fs} />
              </div>
              <div>
                <Label className={_lbl} style={_lblS}>Interest Type</Label>
                <Select value={formData.interestType} onValueChange={v => handleSelectChange('interestType', v)}>
                  <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="variable">Variable</SelectItem><SelectItem value="none">None (0% APR)</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className={_lbl} style={_lblS}>Debt Start Date</Label>
                <Input name="debtStartDate" type="date" value={formData.debtStartDate} onChange={handleChange} className="h-9 text-[13px]" style={_fs} />
              </div>
              <div>
                <Label className={_lbl} style={_lblS}>Color</Label>
                <Select value={formData.billColor || DEBT_COLOR_DEFAULT_SENTINEL} onValueChange={v => handleSelectChange('billColor', v === DEBT_COLOR_DEFAULT_SENTINEL ? '' : v)}>
                  <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue placeholder="Default" /></SelectTrigger>
                  <SelectContent>
                    {DEBT_COLOR_OPTIONS.map(o => (
                      <SelectItem key={o.value || 'default'} value={o.value || DEBT_COLOR_DEFAULT_SENTINEL}>
                        <div className="flex items-center gap-2">{o.value && <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: o.value }} />}<span>{o.label}</span></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between px-2.5 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
              <div>
                <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Include in payoff strategy</p>
                <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Include this debt in your debt payoff calculations</p>
              </div>
              <button type="button" onClick={() => handleCheckboxChange('includeInPayoffStrategy')}
                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
                style={{ backgroundColor: formData.includeInPayoffStrategy ? 'var(--color-primary)' : 'var(--color-border)' }}>
                <span className="inline-block h-3.5 w-3.5 transform rounded-full transition-transform" style={{ backgroundColor: 'var(--color-background)', transform: `translateX(${formData.includeInPayoffStrategy ? '18px' : '2px'})` }} />
              </button>
            </div>
            <div className="flex items-center justify-between px-2.5 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
              <div>
                <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Interest is tax deductible</p>
                <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Track interest for tax purposes</p>
              </div>
              <button type="button" onClick={() => handleCheckboxChange('isInterestTaxDeductible')}
                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
                style={{ backgroundColor: formData.isInterestTaxDeductible ? 'var(--color-primary)' : 'var(--color-border)' }}>
                <span className="inline-block h-3.5 w-3.5 transform rounded-full transition-transform" style={{ backgroundColor: 'var(--color-background)', transform: `translateX(${formData.isInterestTaxDeductible ? '18px' : '2px'})` }} />
              </button>
            </div>
            {formData.isInterestTaxDeductible && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className={_lbl} style={_lblS}>Deduction Type</Label>
                  <Select value={formData.taxDeductionType} onValueChange={v => handleSelectChange('taxDeductionType', v)}>
                    <SelectTrigger className="h-9 text-[13px]" style={_fs}><SelectValue /></SelectTrigger>
                    <SelectContent>{TAX_DEDUCTION_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className={_lbl} style={_lblS}>Annual Limit</Label>
                  <Input name="taxDeductionLimit" type="number" value={formData.taxDeductionLimit} onChange={handleChange} placeholder="e.g., 2500" step="0.01" className="h-9 text-[13px] tabular-nums" style={_fs} />
                  <p className={_hint} style={_hintS}>Leave blank for no limit</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========== ADVANCED SECTION (Collapsible) ========== */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 transition-colors"
          style={{ backgroundColor: showAdvanced ? 'var(--color-elevated)' : 'var(--color-background)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Advanced Options</span>
            {(formData.payeePatterns.length > 0 || formData.notes) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>Configured</span>
            )}
          </div>
          {showAdvanced ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />}
        </button>

        {showAdvanced && (
          <div className="px-4 py-4 space-y-4" style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <div>
              <Label className={_lbl} style={_lblS}>Amount Tolerance (%)</Label>
              <Input name="amountTolerance" type="number" value={formData.amountTolerance} onChange={handleChange} placeholder="5.0" step="0.1" className="h-9 text-[13px]" style={_fs} />
              <p className={_hint} style={_hintS}>For auto-matching transactions (default 5%)</p>
            </div>

            <div>
              <Label className={_lbl} style={_lblS}>Payee Patterns</Label>
              <p className={_hint + ' mb-2'} style={_hintS}>Add patterns to match transaction descriptions</p>
              <div className="space-y-1.5">
                {formData.payeePatterns.map((pattern: string, index: number) => (
                  <div key={index} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                    <span className="text-[13px]" style={{ color: 'var(--color-foreground)' }}>{pattern}</span>
                    <button type="button" onClick={() => handleRemovePayeePattern(index)} className="text-[11px] transition-opacity hover:opacity-100 opacity-60" style={{ color: 'var(--color-destructive)' }}>Remove</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input value={newPayeePattern} onChange={e => setNewPayeePattern(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPayeePattern(); } }} placeholder="Enter a pattern" className="h-9 text-[13px]" style={_fs} />
                  <Button type="button" onClick={handleAddPayeePattern} variant="outline" className="h-9 text-[12px] shrink-0">Add</Button>
                </div>
              </div>
            </div>

            <div>
              <Label className={_lbl} style={_lblS}>Notes</Label>
              <Textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Add any additional notes…" className="text-[13px] resize-none" style={_fs} rows={3} />
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 6%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
        <div>
          <p className="text-[12px] font-semibold mb-0.5" style={{ color: 'var(--color-primary)' }}>Category-Based Bill Matching</p>
          <p className="text-[11px]" style={{ color: 'var(--color-primary)', opacity: 0.8 }}>When you create an expense transaction with the selected category, the oldest unpaid bill instance will be automatically marked as paid.</p>
        </div>
      </div>

      <BillFormActions
        hasExistingBill={Boolean(bill)}
        isLoading={isLoading}
        saveMode={saveMode}
        onSave={() => setSaveMode('save')}
        onSaveAndAdd={() => setSaveMode('saveAndAdd')}
        onCancel={onCancel}
      />
    </form>
  );
}
