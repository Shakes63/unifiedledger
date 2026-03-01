'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Check, ArrowDownCircle } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { DAY_OF_WEEK_OPTIONS } from '@/lib/bills/bill-utils';

interface Category {
  id: string;
  name: string;
  type: string;
}

interface QuickAddIncomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIncomeCreated?: () => void;
}

// Income classification options
const INCOME_TYPES = [
  { value: 'salary', label: 'Salary/Wages' },
  { value: 'rental', label: 'Rental Income' },
  { value: 'investment', label: 'Investment/Dividends' },
  { value: 'freelance', label: 'Freelance/Contract' },
  { value: 'benefits', label: 'Government Benefits' },
  { value: 'other', label: 'Other' },
];

// Only support simple frequencies in Quick Add
const QUICK_ADD_FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
];

export function QuickAddIncomeModal({
  open,
  onOpenChange,
  onIncomeCreated,
}: QuickAddIncomeModalProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [expectedDate, setExpectedDate] = useState('1');
  const [incomeType, setIncomeType] = useState('salary');
  const [categoryId, setCategoryId] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Track if form has data for discard confirmation
  const hasData = name.trim() !== '' || amount !== '';

  // Fetch categories on mount
  useEffect(() => {
    if (open && selectedHouseholdId) {
      fetchWithHousehold('/api/categories')
        .then((res) => res.json())
        .then((data) => {
          setCategories(Array.isArray(data) ? data : []);
        })
        .catch(console.error);
    }
  }, [open, selectedHouseholdId, fetchWithHousehold]);

  const resetForm = useCallback(() => {
    setName('');
    setAmount('');
    setFrequency('monthly');
    setExpectedDate('1');
    setIncomeType('salary');
    setCategoryId('');
  }, []);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        resetForm();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open, resetForm]);

  const handleClose = useCallback(() => {
    if (hasData) {
      setShowDiscardConfirm(true);
    } else {
      onOpenChange(false);
    }
  }, [hasData, onOpenChange]);

  const handleConfirmDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = async (saveAndAddAnother: boolean = false) => {
    // Validation
    if (!name.trim()) {
      toast.error('Income source name is required');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const parsedDate = parseInt(expectedDate);
    if (isNaN(parsedDate)) {
      toast.error('Please select an expected date');
      return;
    }

    // Validate date range
    const isWeekBased = frequency === 'weekly' || frequency === 'biweekly';
    if (isWeekBased) {
      if (parsedDate < 0 || parsedDate > 6) {
        toast.error('Please select a valid day of week');
        return;
      }
    } else {
      if (parsedDate < 1 || parsedDate > 31) {
        toast.error('Day must be between 1 and 31');
        return;
      }
    }

    try {
      setLoading(true);

      const incomeData: Record<string, unknown> = {
        name: name.trim(),
        defaultAmountCents: Math.round(parsedAmount * 100),
        recurrenceType: frequency === 'weekly' || frequency === 'biweekly' ? frequency : 'monthly',
        recurrenceDueDay: frequency === 'monthly' ? parsedDate : null,
        recurrenceDueWeekday: frequency === 'weekly' || frequency === 'biweekly' ? parsedDate : null,
        recurrenceSpecificDueDate: null,
        recurrenceStartMonth: null,
        categoryId: categoryId || null,
        billType: 'income',
        classification: 'other',
        classificationSubcategory: incomeType,
        autoMarkPaid: true,
      };

      const response = await fetchWithHousehold('/api/bills/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incomeData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create income source');
      }

      toast.success(`Income source "${name}" created successfully`);

      if (saveAndAddAnother) {
        resetForm();
        setTimeout(() => {
          document.getElementById('quick-add-income-name')?.focus();
        }, 100);
      } else {
        onOpenChange(false);
      }

      onIncomeCreated?.();
    } catch (error) {
      console.error('Error creating income source:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create income source');
    } finally {
      setLoading(false);
    }
  };

  const isWeekBased = frequency === 'weekly' || frequency === 'biweekly';

  const fieldStyle = { backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' };
  const labelCls = 'text-[11px] font-medium uppercase tracking-wide block mb-1.5';
  const labelStyle = { color: 'var(--color-muted-foreground)' };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[400px]" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--color-foreground)' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklch, var(--color-income) 15%, transparent)' }}>
                <ArrowDownCircle className="w-3.5 h-3.5" style={{ color: 'var(--color-income)' }} />
              </div>
              Add Income Source
            </DialogTitle>
            <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
              Add a recurring income source quickly. Use the full form for advanced options.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(false); }} className="space-y-3 mt-1">
            {/* Name */}
            <div>
              <Label htmlFor="quick-add-income-name" className={labelCls} style={labelStyle}>Income Source Name</Label>
              <Input id="quick-add-income-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Monthly Salary, Rental Income" className="h-9 text-[13px]" style={fieldStyle} autoFocus />
            </div>

            {/* Amount */}
            <div>
              <Label htmlFor="quick-add-income-amount" className={labelCls} style={labelStyle}>Expected Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium" style={{ color: 'var(--color-muted-foreground)' }}>$</span>
                <Input id="quick-add-income-amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pl-7 h-9 text-[13px] tabular-nums" style={fieldStyle} />
              </div>
            </div>

            {/* Type and Frequency */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className={labelCls} style={labelStyle}>Type</Label>
                <Select value={incomeType} onValueChange={setIncomeType}>
                  <SelectTrigger className="h-9 text-[13px]" style={fieldStyle}><SelectValue /></SelectTrigger>
                  <SelectContent>{INCOME_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className={labelCls} style={labelStyle}>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger className="h-9 text-[13px]" style={fieldStyle}><SelectValue /></SelectTrigger>
                  <SelectContent>{QUICK_ADD_FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Expected Date */}
            <div>
              <Label className={labelCls} style={labelStyle}>{isWeekBased ? 'Day of Week' : 'Day of Month'}</Label>
              {isWeekBased ? (
                <Select value={expectedDate} onValueChange={setExpectedDate}>
                  <SelectTrigger className="h-9 text-[13px]" style={fieldStyle}><SelectValue /></SelectTrigger>
                  <SelectContent>{DAY_OF_WEEK_OPTIONS.map(d => <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input type="number" min="1" max="31" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} placeholder="1" className="h-9 text-[13px]" style={fieldStyle} />
              )}
            </div>

            {/* Category */}
            <div>
              <Label className={labelCls} style={labelStyle}>Category <span style={{ opacity: 0.6 }}>(optional)</span></Label>
              <Select value={categoryId || 'none'} onValueChange={val => setCategoryId(val === 'none' ? '' : val)}>
                <SelectTrigger className="h-9 text-[13px]" style={fieldStyle}><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={loading} className="flex-1 h-9 text-[12px]" style={{ backgroundColor: 'var(--color-income)', color: 'white' }}>
                {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}Save
              </Button>
              <Button type="button" onClick={() => handleSubmit(true)} disabled={loading} variant="outline" className="flex-1 h-9 text-[12px]">
                <Plus className="w-3.5 h-3.5 mr-1.5" />Save & Add Another
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--color-foreground)' }}>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--color-muted-foreground)' }}>You have unsaved changes. Close without saving?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[12px]">Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscard} className="text-[12px]" style={{ backgroundColor: 'var(--color-destructive)', color: 'white' }}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
