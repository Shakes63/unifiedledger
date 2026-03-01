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

  const fs = { backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' };
  const lbl = 'text-[11px] font-medium uppercase tracking-wide block mb-1.5';
  const lblStyle = { color: 'var(--color-muted-foreground)' };
  const errStyle = { color: 'var(--color-destructive)' };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name and Amount */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="income-name" className={lbl} style={errors.name ? errStyle : lblStyle}>Income Source Name*</Label>
          <Input
            id="income-name"
            name="name"
            value={formData.name}
            onChange={(e) => { handleChange(e); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }}
            placeholder="e.g., Monthly Salary, Rental Income"
            className="h-9 text-[13px]"
            style={{ ...fs, borderColor: errors.name ? 'var(--color-destructive)' : 'var(--color-border)' }}
          />
          {errors.name && <p className="text-[11px] mt-1" style={errStyle}>{errors.name}</p>}
        </div>
        <div>
          <Label className={lbl} style={errors.expectedAmount ? errStyle : lblStyle}>Expected Amount*</Label>
          <Input
            name="expectedAmount"
            type="number"
            value={formData.expectedAmount}
            onChange={(e) => { handleChange(e); if (errors.expectedAmount) setErrors(prev => ({ ...prev, expectedAmount: '' })); }}
            placeholder="0.00"
            step="0.01"
            className="h-9 text-[13px] tabular-nums"
            style={{ ...fs, borderColor: errors.expectedAmount ? 'var(--color-destructive)' : 'var(--color-border)' }}
          />
          {errors.expectedAmount && <p className="text-[11px] mt-1" style={errStyle}>{errors.expectedAmount}</p>}
        </div>
      </div>

      {/* Frequency and Expected Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className={lbl} style={lblStyle}>Frequency*</Label>
          <Select value={formData.frequency} onValueChange={v => handleSelectChange('frequency', v)}>
            <SelectTrigger className="h-9 text-[13px]" style={fs}><SelectValue /></SelectTrigger>
            <SelectContent>
              {['one-time','weekly','biweekly','monthly','quarterly','semi-annual','annual'].map(f => (
                <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f as keyof typeof FREQUENCY_LABELS]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={lbl} style={lblStyle}>{getDueDateLabel(formData.frequency).replace('Due', 'Expected')}*</Label>
          {isOneTimeFrequency(formData.frequency) ? (
            <Input name="specificDueDate" type="date" value={formData.specificDueDate} onChange={handleChange} className="h-9 text-[13px]" style={fs} required />
          ) : isWeekBasedFrequency(formData.frequency) ? (
            <Select value={formData.dueDate} onValueChange={v => handleSelectChange('dueDate', v)}>
              <SelectTrigger className="h-9 text-[13px]" style={fs}><SelectValue placeholder="Select day of week" /></SelectTrigger>
              <SelectContent>{DAY_OF_WEEK_OPTIONS.map(d => <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <Input name="dueDate" type="number" value={formData.dueDate} onChange={handleChange} placeholder="1" min="1" max="31" className="h-9 text-[13px]" style={fs} />
          )}
        </div>
      </div>

      {/* Start Month */}
      {isNonMonthlyPeriodic(formData.frequency) && (
        <div>
          <Label className={lbl} style={lblStyle}>Start Month*</Label>
          <Select value={formData.startMonth} onValueChange={v => handleSelectChange('startMonth', v)}>
            <SelectTrigger className="h-9 text-[13px]" style={fs}><SelectValue placeholder="Select month" /></SelectTrigger>
            <SelectContent>{MONTH_OPTIONS.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {/* Classification and Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className={lbl} style={lblStyle}>Income Type</Label>
          <Select value={formData.billClassification} onValueChange={v => handleSelectChange('billClassification', v)}>
            <SelectTrigger className="h-9 text-[13px]" style={fs}><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>{INCOME_CLASSIFICATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className={lbl} style={lblStyle}>Category</Label>
          <Select value={formData.categoryId} onValueChange={v => handleSelectChange('categoryId', v)}>
            <SelectTrigger className="h-9 text-[13px]" style={fs}><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Receiving Account */}
      <div>
        <Label className={lbl} style={lblStyle}>Receiving Account</Label>
        <Select value={formData.accountId} onValueChange={v => handleSelectChange('accountId', v)}>
          <SelectTrigger className="h-9 text-[13px]" style={fs}><SelectValue placeholder="Select account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted-foreground)', opacity: 0.75 }}>The account where you receive this income</p>
      </div>

      {/* Toggles */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
        <div className="flex items-center justify-between px-3 py-3" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
          <div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Variable Amount</p>
            <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Amount varies each time</p>
          </div>
          <button type="button" onClick={() => handleCheckboxChange('isVariableAmount')}
            className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
            style={{ backgroundColor: formData.isVariableAmount ? 'var(--color-income)' : 'var(--color-border)' }}>
            <span className="inline-block h-3.5 w-3.5 transform rounded-full transition-transform" style={{ backgroundColor: 'var(--color-background)', transform: `translateX(${formData.isVariableAmount ? '18px' : '2px'})` }} />
          </button>
        </div>
        <div className="flex items-center justify-between px-3 py-3">
          <div>
            <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Auto-mark Received</p>
            <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Mark as received when matching transaction is created</p>
          </div>
          <button type="button" onClick={() => handleCheckboxChange('autoMarkPaid')}
            className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0"
            style={{ backgroundColor: formData.autoMarkPaid ? 'var(--color-income)' : 'var(--color-border)' }}>
            <span className="inline-block h-3.5 w-3.5 transform rounded-full transition-transform" style={{ backgroundColor: 'var(--color-background)', transform: `translateX(${formData.autoMarkPaid ? '18px' : '2px'})` }} />
          </button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label className={lbl} style={lblStyle}>Notes</Label>
        <Textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Add any additional notes..." className="text-[13px] resize-none" style={fs} rows={3} />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex gap-2">
          <Button type="submit" onClick={() => setSaveMode('save')} disabled={isLoading} className="flex-1 h-9 text-[13px]" style={{ backgroundColor: 'var(--color-income)', color: 'white' }}>
            {income ? (isLoading && saveMode === 'save' ? 'Updating…' : 'Update Income') : (isLoading && saveMode === 'save' ? 'Saving…' : 'Save Income')}
          </Button>
          {!income && (
            <Button type="submit" onClick={() => setSaveMode('saveAndAdd')} disabled={isLoading} variant="outline" className="flex-1 h-9 text-[13px]">
              {isLoading && saveMode === 'saveAndAdd' ? 'Saving…' : 'Save & Add Another'}
            </Button>
          )}
        </div>
        <Button type="button" onClick={onCancel} variant="outline" className="h-9 text-[13px]">Cancel</Button>
      </div>
    </form>
  );
}

