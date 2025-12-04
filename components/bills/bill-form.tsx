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
import { AlertCircle, Plus, X, ChevronDown, ChevronUp, CreditCard, Landmark, Info, DollarSign, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
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

// Bill type options
const BILL_TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense', description: 'Money going out (bills, subscriptions, etc.)' },
  { value: 'income', label: 'Income', description: 'Money coming in (salary, rent, dividends, etc.)' },
] as const;

// Bill classification options for expense bills
const EXPENSE_CLASSIFICATION_OPTIONS = [
  { value: 'subscription', label: 'Subscription' },
  { value: 'utility', label: 'Utility' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'loan_payment', label: 'Loan Payment' },
  { value: 'credit_card', label: 'Credit Card Payment' },
  { value: 'rent_mortgage', label: 'Rent/Mortgage' },
  { value: 'other', label: 'Other' },
] as const;

// Bill classification options for income bills
const INCOME_CLASSIFICATION_OPTIONS = [
  { value: 'salary', label: 'Salary/Wages' },
  { value: 'rental', label: 'Rental Income' },
  { value: 'investment', label: 'Investment/Dividends' },
  { value: 'freelance', label: 'Freelance/Contract' },
  { value: 'benefits', label: 'Government Benefits' },
  { value: 'refund', label: 'Refunds/Reimbursements' },
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
  billClassification?: 'subscription' | 'utility' | 'insurance' | 'loan_payment' | 'credit_card' | 'rent_mortgage' | 'other';
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
  });

  // Collapsible sections state
  const [showDebtSection, setShowDebtSection] = useState(bill?.isDebt || false);
  const [showAutopaySection, setShowAutopaySection] = useState(bill?.isAutopayEnabled || false);
  const [showAdvancedSection, setShowAdvancedSection] = useState(false);

  const [categories, setCategories] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Array<{ id: string; name: string; remainingBalance?: number }>>([]);
  const [newPayeePattern, setNewPayeePattern] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  
  // Filter accounts to get only credit cards and lines of credit
  const creditAccounts = accounts.filter(a => a.type === 'credit' || a.type === 'line_of_credit');

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
        credentials: 'include',
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

    // Debt-specific validation
    if (formData.isDebt) {
      if (!formData.originalBalance || parseFloat(String(formData.originalBalance)) <= 0) {
        toast.error('Original balance is required for debt bills');
        setSaveMode(null);
        return;
      }
    }

    // Autopay validation
    if (formData.isAutopayEnabled) {
      if (!formData.autopayAccountId) {
        toast.error('Source account is required for autopay');
        setSaveMode(null);
        return;
      }
    }

    // Validate linkedAccountId and chargedToAccountId are mutually exclusive
    if (formData.linkedAccountId && formData.chargedToAccountId) {
      toast.error('A bill cannot be both a payment to a card and charged to a card');
      setSaveMode(null);
      return;
    }

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
      billClassification: formData.billClassification as 'subscription' | 'utility' | 'insurance' | 'loan_payment' | 'credit_card' | 'rent_mortgage' | 'other',
      
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
      });
      setNewPayeePattern('');
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setSaveMode(null);
      setShowDebtSection(false);
      setShowAutopaySection(false);
      setShowAdvancedSection(false);

      // Focus on name field for quick data entry
      setTimeout(() => {
        document.getElementById('bill-name')?.focus();
      }, 100);
    }
  };

  // Determine if this is an income bill
  const isIncomeBill = formData.billType === 'income';
  
  // Get classification options based on bill type
  const classificationOptions = isIncomeBill 
    ? INCOME_CLASSIFICATION_OPTIONS 
    : EXPENSE_CLASSIFICATION_OPTIONS;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Bill Type Selector */}
      <div className="p-4 bg-card rounded-lg border border-border">
        <Label className="text-muted-foreground text-sm mb-3 block">Bill Type*</Label>
        <div className="grid grid-cols-2 gap-3">
          {BILL_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                handleSelectChange('billType', option.value);
                // Reset classification when switching types
                handleSelectChange('billClassification', 'other');
                // Clear income-incompatible fields when switching to income
                if (option.value === 'income') {
                  handleSelectChange('isDebt', 'false');
                  handleSelectChange('linkedAccountId', '');
                  handleSelectChange('chargedToAccountId', '');
                  setShowDebtSection(false);
                }
              }}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                formData.billType === option.value
                  ? option.value === 'income'
                    ? 'border-[var(--color-income)] bg-[var(--color-income)]/10'
                    : 'border-[var(--color-expense)] bg-[var(--color-expense)]/10'
                  : 'border-border bg-elevated hover:bg-card'
              }`}
            >
              {option.value === 'income' ? (
                <ArrowDownCircle className={`w-6 h-6 ${
                  formData.billType === option.value 
                    ? 'text-[var(--color-income)]' 
                    : 'text-muted-foreground'
                }`} />
              ) : (
                <ArrowUpCircle className={`w-6 h-6 ${
                  formData.billType === option.value 
                    ? 'text-[var(--color-expense)]' 
                    : 'text-muted-foreground'
                }`} />
              )}
              <div className="text-left">
                <p className={`font-medium ${
                  formData.billType === option.value 
                    ? 'text-foreground' 
                    : 'text-muted-foreground'
                }`}>
                  {option.label}
                </p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Name and Amount */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground text-sm mb-2 block">
            {isIncomeBill ? 'Income Source Name*' : 'Bill Name*'}
          </Label>
          <Input
            id="bill-name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={isIncomeBill ? "e.g., Monthly Salary" : "e.g., Electric Bill"}
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
          <Label className="text-muted-foreground text-sm mb-2 block">
            {isIncomeBill 
              ? getDueDateLabel(formData.frequency).replace('Due', 'Expected')
              : getDueDateLabel(formData.frequency)}*
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
                {isIncomeBill ? 'Select the specific date you expect this income' : 'Select the specific date for this bill'}
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

      {/* Category, Merchant, and Account */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <MerchantSelector
            selectedMerchant={formData.merchantId || null}
            onMerchantChange={(merchantId) => handleSelectChange('merchantId', merchantId || '')}
          />
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
            <Label className="text-muted-foreground text-sm block">
              {isIncomeBill ? 'Auto-mark Received' : 'Auto-mark Paid'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {isIncomeBill 
                ? 'Automatically mark as received on matching transaction'
                : 'Automatically mark as paid on match'}
            </p>
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

      {/* Bill Classification */}
      <div className="p-4 bg-card rounded-lg border border-border">
        <Label className="text-muted-foreground text-sm mb-2 block">
          {isIncomeBill ? 'Income Classification' : 'Bill Classification'}
        </Label>
        <Select 
          value={formData.billClassification} 
          onValueChange={(value) => handleSelectChange('billClassification', value)}
        >
          <SelectTrigger className="bg-elevated border-border text-foreground">
            <SelectValue placeholder="Select classification" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {classificationOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-foreground">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          {isIncomeBill 
            ? 'Helps organize income sources and track expected vs actual'
            : 'Helps organize bills and provides better reports'}
        </p>
      </div>

      {/* Credit Card Linking - For credit card payment bills (not for income bills) */}
      {creditAccounts.length > 0 && !isIncomeBill && (
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
              <div className="mt-2 p-2 bg-[var(--color-primary)]/10 rounded-lg flex items-start gap-2">
                <Info className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--color-primary)]">
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
                <div className="mt-2 p-2 bg-[var(--color-warning)]/10 rounded-lg flex items-start gap-2">
                  <Info className="w-4 h-4 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--color-warning)]">
                    When due, expense will be created on the selected card
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Autopay Configuration */}
      <div className="p-4 bg-card rounded-lg border border-border">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => {
            setShowAutopaySection(!showAutopaySection);
            if (!showAutopaySection) {
              handleCheckboxChange('isAutopayEnabled');
            }
          }}
        >
          <div>
            <Label className="text-muted-foreground text-sm block cursor-pointer">Autopay</Label>
            <p className="text-xs text-muted-foreground">Automatically create payment transactions when due</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowAutopaySection(!formData.isAutopayEnabled);
              handleCheckboxChange('isAutopayEnabled');
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.isAutopayEnabled ? 'bg-[var(--color-income)]' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-card)] transition-transform ${
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

            <div className="p-2 bg-[var(--color-warning)]/10 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-warning)]">
                Autopay will create transactions automatically. Ensure sufficient funds are available in the source account.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Debt Configuration - Not shown for income bills */}
      {!isIncomeBill && (
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
              formData.isDebt ? 'bg-[var(--color-income)]' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-card)] transition-transform ${
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
                  formData.includeInPayoffStrategy ? 'bg-[var(--color-income)]' : 'bg-border'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-card)] transition-transform ${
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
                    formData.isInterestTaxDeductible ? 'bg-[var(--color-income)]' : 'bg-border'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-card)] transition-transform ${
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
      )}

      {/* Payee Patterns */}
      <div>
        <Label className="text-muted-foreground text-sm mb-2 block">Payee Patterns (Optional)</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Add patterns to match transaction descriptions (e.g., &quot;Electric&quot;, &quot;Power Company&quot;)
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
      <div className={`p-4 rounded-lg flex gap-2 ${
        isIncomeBill 
          ? 'bg-[var(--color-income)]/10 border border-[var(--color-income)]/20'
          : 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20'
      }`}>
        <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
          isIncomeBill ? 'text-[var(--color-income)]' : 'text-[var(--color-primary)]'
        }`} />
        <div className={`text-sm ${
          isIncomeBill ? 'text-[var(--color-income)]/80' : 'text-[var(--color-primary)]/80'
        }`}>
          <p className="font-medium mb-1">
            {isIncomeBill ? 'Automatic Income Tracking' : 'Category-Based Bill Matching'}
          </p>
          <p>
            {isIncomeBill
              ? 'When you create an income transaction with the selected category, the oldest expected income instance will be automatically marked as received. This tracks salary, rent, dividends, and other recurring income.'
              : 'When you create an expense transaction with the selected category, the oldest unpaid bill instance will be automatically marked as paid. This handles late payments, early payments, and multiple payments intelligently.'}
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
            className={`flex-1 text-white hover:opacity-90 font-medium ${
              isIncomeBill ? 'bg-[var(--color-income)]' : 'bg-[var(--color-primary)]'
            }`}
          >
            {bill
              ? isLoading && saveMode === 'save'
                ? 'Updating...'
                : isIncomeBill ? 'Update Income' : 'Update Bill'
              : isLoading && saveMode === 'save'
              ? 'Saving...'
              : isIncomeBill ? 'Save Income' : 'Save'}
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
