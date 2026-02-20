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
import {
  suggestClassification,
  type ClassificationSuggestion,
  type BillClassification,
  CLASSIFICATION_META,
  formatSubcategory,
  getSubcategories
} from '@/lib/bills/bill-classification';

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
  onSubmit: (data: BillData, saveMode?: 'save' | 'saveAndAdd') => void;
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

    onSubmit({
      name: formData.name,
      expectedAmount: parseFloat(String(formData.expectedAmount)),
      dueDate: isOneTimeFrequency(formData.frequency) ? null : parseInt(formData.dueDate),
      specificDueDate: isOneTimeFrequency(formData.frequency) ? formData.specificDueDate : null,
      startMonth: isNonMonthlyPeriodic(formData.frequency) ? parseInt(formData.startMonth) : null,
      frequency: formData.frequency,
      isVariableAmount: formData.isVariableAmount,
      amountTolerance: parseFloat(String(formData.amountTolerance)) || 5.0,
      categoryId: formData.categoryId || null,
      merchantId: formData.merchantId || null,
      debtId: formData.debtId || null,
      accountId: formData.accountId || null,
      autoMarkPaid: formData.autoMarkPaid,
      payeePatterns: formData.payeePatterns.length > 0 ? formData.payeePatterns : null,
      notes: formData.notes || null,
      
      // Bill classification
      billType: formData.billType as 'expense' | 'income' | 'savings_transfer',
      billClassification: formData.billClassification as 'subscription' | 'utility' | 'housing' | 'insurance' | 'loan_payment' | 'membership' | 'service' | 'other',
      classificationSubcategory: formData.classificationSubcategory || null,

      // Account linking
      linkedAccountId: formData.linkedAccountId || null,
      amountSource: formData.linkedAccountId ? formData.amountSource as 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance' : 'fixed',
      chargedToAccountId: formData.chargedToAccountId || null,
      
      // Autopay
      isAutopayEnabled: formData.isAutopayEnabled,
      autopayAccountId: formData.isAutopayEnabled ? formData.autopayAccountId || null : null,
      autopayAmountType: formData.isAutopayEnabled ? formData.autopayAmountType as 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance' : undefined,
      autopayFixedAmount: formData.isAutopayEnabled && formData.autopayAmountType === 'fixed' && formData.autopayFixedAmount 
        ? parseFloat(String(formData.autopayFixedAmount)) 
        : undefined,
      autopayDaysBefore: formData.isAutopayEnabled ? formData.autopayDaysBefore : undefined,
      
      // Debt extension
      isDebt: formData.isDebt,
      originalBalance: formData.isDebt && formData.originalBalance ? parseFloat(String(formData.originalBalance)) : undefined,
      remainingBalance: formData.isDebt && formData.remainingBalance 
        ? parseFloat(String(formData.remainingBalance)) 
        : formData.isDebt && formData.originalBalance 
          ? parseFloat(String(formData.originalBalance)) 
          : undefined,
      billInterestRate: formData.isDebt && formData.billInterestRate ? parseFloat(String(formData.billInterestRate)) : undefined,
      interestType: formData.isDebt ? formData.interestType as 'fixed' | 'variable' | 'none' : undefined,
      debtStartDate: formData.isDebt && formData.debtStartDate ? formData.debtStartDate : null,
      billColor: formData.isDebt && formData.billColor ? formData.billColor : null,
      
      // Payoff strategy
      includeInPayoffStrategy: formData.isDebt ? formData.includeInPayoffStrategy : undefined,
      
      // Tax deduction
      isInterestTaxDeductible: formData.isDebt ? formData.isInterestTaxDeductible : undefined,
      taxDeductionType: formData.isDebt && formData.isInterestTaxDeductible 
        ? formData.taxDeductionType as 'mortgage' | 'student_loan' | 'business' | 'heloc_home' | 'none' 
        : undefined,
      taxDeductionLimit: formData.isDebt && formData.isInterestTaxDeductible && formData.taxDeductionLimit 
        ? parseFloat(String(formData.taxDeductionLimit)) 
        : undefined,
      
      // Budget period assignment
      budgetPeriodAssignment: formData.budgetPeriodAssignment && formData.budgetPeriodAssignment !== 'auto'
        ? parseInt(formData.budgetPeriodAssignment)
        : null,
      
      // Split payment across periods
      splitAcrossPeriods: formData.splitAcrossPeriods,
      splitAllocations: formData.splitAcrossPeriods 
        ? JSON.stringify(
            coerceSplitAllocations(
              formData.splitAllocations as SplitAllocation[],
              Math.max(1, budgetSchedule?.periodsInMonth ?? 2)
            )
          )
        : null,
    }, saveMode || 'save');

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name and Amount */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className={`text-sm mb-2 block ${errors.name ? 'text-error' : 'text-muted-foreground'}`}>
            Bill Name*
          </Label>
          <Input
            id="bill-name"
            name="name"
            value={formData.name}
            onChange={(e) => {
              handleChange(e);
              if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
            }}
            placeholder="e.g., Electric Bill, Netflix"
            className={`bg-elevated text-foreground placeholder:text-muted-foreground/50 placeholder:italic ${
              errors.name ? 'border-error' : 'border-border'
            }`}
          />
          {errors.name && (
            <p className="text-error text-xs mt-1">{errors.name}</p>
          )}
          {/* Classification Suggestion Banner */}
          {classificationSuggestion && classificationSuggestion.confidence >= 0.7 && (
            <div 
              className="mt-2 p-2.5 rounded-lg border flex items-center justify-between gap-2"
              style={{ 
                backgroundColor: `${CLASSIFICATION_META[classificationSuggestion.classification].color}10`,
                borderColor: `${CLASSIFICATION_META[classificationSuggestion.classification].color}30`
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles 
                  className="w-4 h-4 shrink-0" 
                  style={{ color: CLASSIFICATION_META[classificationSuggestion.classification].color }}
                />
                <span 
                  className="text-sm"
                  style={{ color: CLASSIFICATION_META[classificationSuggestion.classification].color }}
                >
                  Suggested: <strong>{CLASSIFICATION_META[classificationSuggestion.classification].label}</strong>
                  {classificationSuggestion.subcategory && (
                    <span className="text-xs opacity-80"> ({formatSubcategory(classificationSuggestion.subcategory)})</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={applySuggestion}
                  className="h-7 px-2 text-xs"
                  style={{ 
                    backgroundColor: CLASSIFICATION_META[classificationSuggestion.classification].color,
                    color: 'white'
                  }}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Apply
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={dismissSuggestion}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
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
          <Label className="text-muted-foreground text-sm mb-2 block">
            {getDueDateLabel(formData.frequency)}*
          </Label>

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
              <p className="text-xs text-muted-foreground mt-1">
                Select the specific date for this bill
              </p>
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

      {/* Start Month - Only for quarterly/semi-annual/annual bills */}
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
          <p className="text-xs text-muted-foreground mt-1">
            The month when your first bill is due
          </p>
        </div>
      )}

      {/* ========== CATEGORIZATION SECTION (Collapsible) ========== */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCategorization(!showCategorization)}
          className="w-full flex items-center justify-between p-4 bg-card hover:bg-elevated transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-foreground font-medium">Categorization</span>
            {(formData.categoryId || formData.merchantId || formData.billClassification !== 'other') && (
              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                {[formData.categoryId && 'Category', formData.merchantId && 'Merchant', formData.billClassification !== 'other' && 'Classification'].filter(Boolean).join(', ')}
              </span>
            )}
          </div>
          {showCategorization ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {showCategorization && (
          <div className="p-4 pt-0 space-y-4 border-t border-border bg-card">
            {/* Category and Merchant */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Category</Label>
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
                      className="flex-1 bg-card border border-primary text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={handleCreateCategory}
                      disabled={creatingCategory || !newCategoryName.trim()}
                      className="bg-primary hover:opacity-90 text-primary-foreground"
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
                <MerchantSelector
                  selectedMerchant={formData.merchantId || null}
                  onMerchantChange={(merchantId) => handleSelectChange('merchantId', merchantId || '')}
                />
              </div>
            </div>

            {/* Bill Classification */}
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Classification</Label>
              <Select
                value={formData.billClassification}
                onValueChange={(value) => {
                  handleSelectChange('billClassification', value);
                  setFormData(prev => ({ ...prev, classificationSubcategory: null }));
                }}
              >
                <SelectTrigger className="bg-elevated border-border text-foreground">
                  <SelectValue placeholder="Select classification" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {CLASSIFICATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-foreground">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategory */}
            {getSubcategories(formData.billClassification as BillClassification).length > 0 && (
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Subcategory</Label>
                <Select
                  value={formData.classificationSubcategory || 'none'}
                  onValueChange={(value) => handleSelectChange('classificationSubcategory', value === 'none' ? '' : value)}
                >
                  <SelectTrigger className="bg-elevated border-border text-foreground">
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="none" className="text-foreground">None</SelectItem>
                    {getSubcategories(formData.billClassification as BillClassification).map((subcategory) => (
                      <SelectItem key={subcategory} value={subcategory} className="text-foreground">
                        {formatSubcategory(subcategory)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========== PAYMENT SETTINGS SECTION (Collapsible) ========== */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPaymentSettings(!showPaymentSettings)}
          className="w-full flex items-center justify-between p-4 bg-card hover:bg-elevated transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-foreground font-medium">Payment Settings</span>
            {(formData.accountId || formData.linkedAccountId || formData.chargedToAccountId || formData.isAutopayEnabled) && (
              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                Configured
              </span>
            )}
          </div>
          {showPaymentSettings ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {showPaymentSettings && (
          <div className="p-4 pt-0 space-y-4 border-t border-border bg-card">
            {/* Payment Account */}
            <div className="pt-4">
              <Label className="text-muted-foreground text-sm mb-2 block">Payment Account</Label>
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
              <p className="text-xs text-muted-foreground mt-1">The account used to pay this bill</p>
            </div>

            {/* Link to Debt */}
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Link to Debt</Label>
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
              <p className="text-xs text-muted-foreground mt-1">Payments will reduce the debt balance</p>
            </div>
          </div>
        )}
      </div>

      {/* Basic Toggles */}
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
            <Label className="text-muted-foreground text-sm block">
              Auto-mark Paid
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically mark as paid when a matching transaction is created
            </p>
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

      {/* Budget Period Assignment - only show if more than 1 period per month */}
      {budgetSchedule && budgetSchedule.periodsInMonth > 1 && (
        <div className="p-4 bg-card rounded-lg border border-border">
          <Label className="text-muted-foreground text-sm mb-2 block">
            Budget Period Assignment (Optional)
          </Label>
          <Select 
            value={formData.budgetPeriodAssignment} 
            onValueChange={(value) => handleSelectChange('budgetPeriodAssignment', value)}
          >
            <SelectTrigger className="bg-elevated border-border text-foreground">
              <SelectValue placeholder="Automatic (based on due date)" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="auto" className="text-foreground">Automatic (based on due date)</SelectItem>
              {Array.from({ length: budgetSchedule.periodsInMonth }, (_, index) => {
                const periodNumber = index + 1;
                return (
                  <SelectItem key={periodNumber} value={String(periodNumber)} className="text-foreground">
                    {getPeriodAssignmentOptionLabel(
                      periodNumber,
                      budgetSchedule.frequency,
                      budgetSchedule.periodsInMonth
                    )}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Override which budget period this bill appears in for Bill Pay. Useful when you want to pay a bill before its due date.
          </p>

          {/* Split Payment Option */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="splitAcrossPeriods"
                checked={formData.splitAcrossPeriods}
                onChange={() => handleCheckboxChange('splitAcrossPeriods')}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="splitAcrossPeriods" className="text-sm text-foreground cursor-pointer">
                Split payment across budget periods
              </Label>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Pay part of this bill in each budget period (e.g., half at the start, half at the end of the month)
            </p>
            
            {formData.splitAcrossPeriods && (
              <div className="space-y-3 bg-elevated p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Set the percentage of the bill to pay in each period:
                </p>
                <div className={`grid gap-2 ${budgetSchedule.periodsInMonth <= 2 ? 'grid-cols-2' : budgetSchedule.periodsInMonth <= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}>
                  {splitAllocationsForSchedule.map((allocation) => (
                    <div key={allocation.periodNumber}>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        {getPeriodAssignmentOptionLabel(
                          allocation.periodNumber,
                          budgetSchedule.frequency,
                          budgetSchedule.periodsInMonth
                        ).replace('Always ', '')}
                      </Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={allocation.percentage}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setFormData((prev) => ({
                              ...prev,
                              splitAllocations: coerceSplitAllocations(
                                (prev.splitAllocations as SplitAllocation[]).map((entry) =>
                                  entry.periodNumber === allocation.periodNumber
                                    ? { ...entry, percentage: Number.isFinite(value) ? value : 0 }
                                    : entry
                                ),
                                budgetSchedule.periodsInMonth
                              ),
                            }));
                          }}
                          className="w-16 bg-background border-border text-right text-sm"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className={`text-xs ${Math.abs(splitAllocationTotal - 100) > 0.01 ? 'text-warning' : 'text-muted-foreground'}`}>
                  Total allocation: {splitAllocationTotal.toFixed(2)}%
                </p>
                {errors.splitAllocations && (
                  <p className="text-xs text-error">{errors.splitAllocations}</p>
                )}
                {formData.expectedAmount && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Preview: {splitAllocationsForSchedule.map((a) => 
                      `Period ${a.periodNumber}: $${((parseFloat(String(formData.expectedAmount)) || 0) * a.percentage / 100).toFixed(2)}`
                    ).join(' | ')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Credit Card Linking */}
      {creditAccounts.length > 0 && (
        <div className="p-4 bg-card rounded-lg border border-border space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <Label className="text-muted-foreground text-sm">Linked Credit Card/LOC (Optional)</Label>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              For bills that represent payments to a credit account
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Select 
                  value={formData.linkedAccountId || 'none'} 
                  onValueChange={(value) => {
                    handleSelectChange('linkedAccountId', value === 'none' ? '' : value);
                    // Clear chargedToAccountId if linkedAccountId is set
                    if (value !== 'none') {
                      handleSelectChange('chargedToAccountId', '');
                    }
                  }}
                >
                  <SelectTrigger className="bg-elevated border-border text-foreground">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="none" className="text-foreground">None</SelectItem>
                    {creditAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id} className="text-foreground">
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.linkedAccountId && (
                <div>
                  <Select 
                    value={formData.amountSource} 
                    onValueChange={(value) => handleSelectChange('amountSource', value)}
                  >
                    <SelectTrigger className="bg-elevated border-border text-foreground">
                      <SelectValue placeholder="Payment amount" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="fixed" className="text-foreground">Fixed Amount</SelectItem>
                      <SelectItem value="minimum_payment" className="text-foreground">Minimum Payment</SelectItem>
                      <SelectItem value="statement_balance" className="text-foreground">Statement Balance</SelectItem>
                      <SelectItem value="full_balance" className="text-foreground">Full Balance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {formData.linkedAccountId && (
              <div className="mt-2 p-2 bg-primary/10 rounded-lg flex items-start gap-2">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-primary">
                  Payments to this bill will reduce the credit card balance
                </p>
              </div>
            )}
          </div>

          {/* Charged to Credit Card */}
          {!formData.linkedAccountId && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="w-4 h-4 text-muted-foreground" />
                <Label className="text-muted-foreground text-sm">Charged to Credit Card (Optional)</Label>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                This bill is automatically charged to a credit card
              </p>
              <Select 
                value={formData.chargedToAccountId || 'none'} 
                onValueChange={(value) => handleSelectChange('chargedToAccountId', value === 'none' ? '' : value)}
              >
                <SelectTrigger className="bg-elevated border-border text-foreground">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="none" className="text-foreground">None</SelectItem>
                  {creditAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id} className="text-foreground">
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.chargedToAccountId && (
                <div className="mt-2 p-2 bg-warning/10 rounded-lg flex items-start gap-2">
                  <Info className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-warning">
                    When due, expense will be created on the selected card
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Autopay Configuration */}
      <div className="p-4 bg-elevated rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-muted-foreground text-sm block">Autopay</Label>
            <p className="text-xs text-muted-foreground">Automatically create payment transactions when due</p>
          </div>
          <button
            type="button"
            onClick={() => handleCheckboxChange('isAutopayEnabled')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.isAutopayEnabled ? 'bg-income' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                formData.isAutopayEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {formData.isAutopayEnabled && (
          <div className="mt-4 pt-4 border-t border-border space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Pay From Account*</Label>
                <Select 
                  value={formData.autopayAccountId || 'none'} 
                  onValueChange={(value) => handleSelectChange('autopayAccountId', value === 'none' ? '' : value)}
                >
                  <SelectTrigger className="bg-elevated border-border text-foreground">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="none" className="text-foreground">Select account...</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id} className="text-foreground">
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Amount</Label>
                <Select 
                  value={formData.autopayAmountType} 
                  onValueChange={(value) => handleSelectChange('autopayAmountType', value)}
                >
                  <SelectTrigger className="bg-elevated border-border text-foreground">
                    <SelectValue placeholder="Amount type" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="fixed" className="text-foreground">Fixed Amount</SelectItem>
                    {formData.linkedAccountId && (
                      <>
                        <SelectItem value="minimum_payment" className="text-foreground">Minimum Payment</SelectItem>
                        <SelectItem value="statement_balance" className="text-foreground">Statement Balance</SelectItem>
                        <SelectItem value="full_balance" className="text-foreground">Full Balance</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.autopayAmountType === 'fixed' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-sm mb-2 block">Fixed Amount</Label>
                  <Input
                    name="autopayFixedAmount"
                    type="number"
                    value={formData.autopayFixedAmount}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm mb-2 block">Days Before Due</Label>
                  <Select 
                    value={String(formData.autopayDaysBefore)} 
                    onValueChange={(value) => handleSelectChange('autopayDaysBefore', value)}
                  >
                    <SelectTrigger className="bg-elevated border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {[0, 1, 2, 3, 5, 7, 14].map((days) => (
                        <SelectItem key={days} value={String(days)} className="text-foreground">
                          {days === 0 ? 'On due date' : `${days} day${days > 1 ? 's' : ''} before`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="p-2 bg-warning/10 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning">
                Autopay will create transactions automatically. Ensure sufficient funds are available in the source account.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Debt Configuration */}
      <div className="p-4 bg-card rounded-lg border border-border">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => {
            setShowDebtSection(!showDebtSection);
            if (!showDebtSection && !formData.isDebt) {
              handleCheckboxChange('isDebt');
            }
          }}
        >
          <div>
            <Label className="text-muted-foreground text-sm block cursor-pointer">This is a debt</Label>
            <p className="text-xs text-muted-foreground">Track principal balance, interest, and payoff progress</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowDebtSection(!formData.isDebt);
              handleCheckboxChange('isDebt');
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.isDebt ? 'bg-income' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                formData.isDebt ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {formData.isDebt && (
          <div className="mt-4 pt-4 border-t border-border space-y-4">
            {/* Balance Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Original Balance*</Label>
                <Input
                  name="originalBalance"
                  type="number"
                  value={formData.originalBalance}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Remaining Balance</Label>
                <Input
                  name="remainingBalance"
                  type="number"
                  value={formData.remainingBalance}
                  onChange={handleChange}
                  placeholder="Same as original"
                  step="0.01"
                  className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Interest Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Interest Rate (APR %)</Label>
                <Input
                  name="billInterestRate"
                  type="number"
                  value={formData.billInterestRate}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Interest Type</Label>
                <Select 
                  value={formData.interestType} 
                  onValueChange={(value) => handleSelectChange('interestType', value)}
                >
                  <SelectTrigger className="bg-elevated border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="fixed" className="text-foreground">Fixed</SelectItem>
                    <SelectItem value="variable" className="text-foreground">Variable</SelectItem>
                    <SelectItem value="none" className="text-foreground">None (0% APR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date and Color */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Debt Start Date</Label>
                <Input
                  name="debtStartDate"
                  type="date"
                  value={formData.debtStartDate}
                  onChange={handleChange}
                  className="bg-elevated border-border text-foreground"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm mb-2 block">Color</Label>
                <Select 
                  value={formData.billColor || ''} 
                  onValueChange={(value) => handleSelectChange('billColor', value)}
                >
                  <SelectTrigger className="bg-elevated border-border text-foreground">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {DEBT_COLOR_OPTIONS.map((option) => (
                      <SelectItem key={option.value || 'default'} value={option.value} className="text-foreground">
                        <div className="flex items-center gap-2">
                          {option.value && (
                            <div 
                              className="w-4 h-4 rounded-full" 
                              style={{ backgroundColor: option.value }}
                            />
                          )}
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payoff Strategy Toggle */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <Label className="text-muted-foreground text-sm block">Include in payoff strategy</Label>
                <p className="text-xs text-muted-foreground">Include this debt in your debt payoff calculations</p>
              </div>
              <button
                type="button"
                onClick={() => handleCheckboxChange('includeInPayoffStrategy')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.includeInPayoffStrategy ? 'bg-income' : 'bg-border'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                    formData.includeInPayoffStrategy ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Tax Deduction Toggle */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-muted-foreground text-sm block">Interest is tax deductible</Label>
                  <p className="text-xs text-muted-foreground">Track interest for tax purposes</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCheckboxChange('isInterestTaxDeductible')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.isInterestTaxDeductible ? 'bg-income' : 'bg-border'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                      formData.isInterestTaxDeductible ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {formData.isInterestTaxDeductible && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm mb-2 block">Deduction Type</Label>
                    <Select 
                      value={formData.taxDeductionType} 
                      onValueChange={(value) => handleSelectChange('taxDeductionType', value)}
                    >
                      <SelectTrigger className="bg-elevated border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {TAX_DEDUCTION_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="text-foreground">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm mb-2 block">Annual Limit</Label>
                    <Input
                      name="taxDeductionLimit"
                      type="number"
                      value={formData.taxDeductionLimit}
                      onChange={handleChange}
                      placeholder="e.g., 2500 for student loans"
                      step="0.01"
                      className="bg-elevated border-border text-foreground placeholder:text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave blank for no limit
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========== ADVANCED SECTION (Collapsible) ========== */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-4 bg-card hover:bg-elevated transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-foreground font-medium">Advanced Options</span>
            {(formData.payeePatterns.length > 0 || formData.notes) && (
              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                Configured
              </span>
            )}
          </div>
          {showAdvanced ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {showAdvanced && (
          <div className="p-4 pt-0 space-y-4 border-t border-border bg-card">
            {/* Amount Tolerance */}
            <div className="pt-4">
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
              <p className="text-xs text-muted-foreground mt-1">For auto-matching transactions (default 5%)</p>
            </div>

            {/* Payee Patterns */}
            <div>
              <Label className="text-muted-foreground text-sm mb-2 block">Payee Patterns</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Add patterns to match transaction descriptions
              </p>
              <div className="space-y-2">
                {formData.payeePatterns.map((pattern: string, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-elevated border border-border rounded"
                  >
                    <span className="text-sm text-foreground">{pattern}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePayeePattern(index)}
                      className="text-xs text-error hover:text-error/80"
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
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 rounded-lg flex gap-2 bg-primary/10 border border-primary/20">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
        <div className="text-sm text-primary/80">
          <p className="font-medium mb-1">
            Category-Based Bill Matching
          </p>
          <p>
            When you create an expense transaction with the selected category, the oldest unpaid bill instance will be automatically marked as paid. This handles late payments, early payments, and multiple payments intelligently.
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
            className="flex-1 text-white hover:opacity-90 font-medium bg-primary"
          >
            {bill
              ? isLoading && saveMode === 'save'
                ? 'Updating...'
                : 'Update Bill'
              : isLoading && saveMode === 'save'
              ? 'Saving...'
              : 'Save Bill'}
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
