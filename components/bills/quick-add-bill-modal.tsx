'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { Loader2, Plus, Sparkles, Check, X, ExternalLink } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import {
  suggestClassification,
  CLASSIFICATION_META,
  formatSubcategory,
  type ClassificationSuggestion,
} from '@/lib/bills/bill-classification';
import { DAY_OF_WEEK_OPTIONS } from '@/lib/bills/bill-utils';

interface Category {
  id: string;
  name: string;
  type: string;
}

interface QuickAddBillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBillCreated?: () => void;
}

// Only support simple frequencies in Quick Add
const QUICK_ADD_FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
];

export function QuickAddBillModal({
  open,
  onOpenChange,
  onBillCreated,
}: QuickAddBillModalProps) {
  const router = useRouter();
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [dueDate, setDueDate] = useState('1');
  const [categoryId, setCategoryId] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Classification suggestion
  const [suggestion, setSuggestion] = useState<ClassificationSuggestion | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  // Track if form has data for discard confirmation
  const hasData = name.trim() !== '' || amount !== '' || categoryId !== '';

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

  // Auto-suggest classification based on name
  useEffect(() => {
    if (suggestionDismissed) return;

    const timer = setTimeout(() => {
      if (name.length >= 3) {
        const result = suggestClassification(name);
        setSuggestion(result);
      } else {
        setSuggestion(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [name, suggestionDismissed]);

  const resetForm = useCallback(() => {
    setName('');
    setAmount('');
    setFrequency('monthly');
    setDueDate('1');
    setCategoryId('');
    setSuggestion(null);
    setSuggestionDismissed(false);
  }, []);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      // Delay reset to avoid flicker during close animation
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
      toast.error('Bill name is required');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const parsedDueDate = parseInt(dueDate);
    if (isNaN(parsedDueDate)) {
      toast.error('Please select a due date');
      return;
    }

    // Validate due date range
    const isWeekBased = frequency === 'weekly' || frequency === 'biweekly';
    if (isWeekBased) {
      if (parsedDueDate < 0 || parsedDueDate > 6) {
        toast.error('Please select a valid day of week');
        return;
      }
    } else {
      if (parsedDueDate < 1 || parsedDueDate > 31) {
        toast.error('Due date must be between 1 and 31');
        return;
      }
    }

    try {
      setLoading(true);

      const billData: Record<string, unknown> = {
        name: name.trim(),
        defaultAmountCents: Math.round(parsedAmount * 100),
        recurrenceType: frequency === 'weekly' || frequency === 'biweekly' ? frequency : 'monthly',
        recurrenceDueDay: frequency === 'monthly' ? parsedDueDate : null,
        recurrenceDueWeekday: frequency === 'weekly' || frequency === 'biweekly' ? parsedDueDate : null,
        recurrenceSpecificDueDate: null,
        recurrenceStartMonth: null,
        categoryId: categoryId || null,
        billType: 'expense',
        classification: 'other',
        autoMarkPaid: true,
      };

      // Add classification if we have a high-confidence suggestion
      if (suggestion && suggestion.confidence >= 0.7) {
        billData.classification = suggestion.classification;
        if (suggestion.subcategory) {
          billData.classificationSubcategory = suggestion.subcategory;
        }
      }

      const response = await fetchWithHousehold('/api/bills/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create bill');
      }

      toast.success(`Bill "${name}" created successfully`);

      if (saveAndAddAnother) {
        resetForm();
        // Focus on name input
        setTimeout(() => {
          document.getElementById('quick-add-bill-name')?.focus();
        }, 100);
      } else {
        onOpenChange(false);
      }

      onBillCreated?.();
    } catch (error) {
      console.error('Error creating bill:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create bill');
    } finally {
      setLoading(false);
    }
  };

  const handleMoreOptions = () => {
    // Build query params to pre-fill the full form
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    if (amount) params.set('amount', amount);
    if (frequency) params.set('frequency', frequency);
    if (dueDate) params.set('dueDate', dueDate);
    if (categoryId) params.set('categoryId', categoryId);
    if (suggestion?.classification) {
      params.set('classification', suggestion.classification);
      if (suggestion.subcategory) {
        params.set('subcategory', suggestion.subcategory);
      }
    }

    onOpenChange(false);
    router.push(`/dashboard/bills/new?${params.toString()}`);
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
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)' }}>
                <Plus className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
              </div>
              Quick Add Bill
            </DialogTitle>
            <DialogDescription className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
              Add a recurring expense quickly. Use the full form for advanced options.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(false); }} className="space-y-3 mt-1">
            {/* Name */}
            <div>
              <Label htmlFor="quick-add-bill-name" className={labelCls} style={labelStyle}>Bill Name</Label>
              <Input
                id="quick-add-bill-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Netflix, Electric Bill"
                className="h-9 text-[13px]"
                style={fieldStyle}
                autoFocus
              />
              {suggestion && suggestion.confidence >= 0.7 && (
                <div className="mt-1.5 px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2" style={{ backgroundColor: `${CLASSIFICATION_META[suggestion.classification].color}12`, border: `1px solid ${CLASSIFICATION_META[suggestion.classification].color}30` }}>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 shrink-0" style={{ color: CLASSIFICATION_META[suggestion.classification].color }} />
                    <span className="text-[11px]" style={{ color: CLASSIFICATION_META[suggestion.classification].color }}>
                      Auto: <strong>{CLASSIFICATION_META[suggestion.classification].label}</strong>
                      {suggestion.subcategory && <span className="opacity-70"> · {formatSubcategory(suggestion.subcategory)}</span>}
                    </span>
                  </div>
                  <button type="button" onClick={() => { setSuggestion(null); setSuggestionDismissed(true); }} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" style={{ color: CLASSIFICATION_META[suggestion.classification].color }} />
                  </button>
                </div>
              )}
            </div>

            {/* Amount */}
            <div>
              <Label htmlFor="quick-add-bill-amount" className={labelCls} style={labelStyle}>Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium" style={{ color: 'var(--color-muted-foreground)' }}>$</span>
                <Input id="quick-add-bill-amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pl-7 h-9 text-[13px] tabular-nums" style={fieldStyle} />
              </div>
            </div>

            {/* Frequency and Due Date */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className={labelCls} style={labelStyle}>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger className="h-9 text-[13px]" style={fieldStyle}><SelectValue /></SelectTrigger>
                  <SelectContent>{QUICK_ADD_FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className={labelCls} style={labelStyle}>{isWeekBased ? 'Day of Week' : 'Day of Month'}</Label>
                {isWeekBased ? (
                  <Select value={dueDate} onValueChange={setDueDate}>
                    <SelectTrigger className="h-9 text-[13px]" style={fieldStyle}><SelectValue /></SelectTrigger>
                    <SelectContent>{DAY_OF_WEEK_OPTIONS.map(d => <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input type="number" min="1" max="31" value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="1" className="h-9 text-[13px]" style={fieldStyle} />
                )}
              </div>
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
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1 h-9 text-[12px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
                  {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}Save
                </Button>
                <Button type="button" onClick={() => handleSubmit(true)} disabled={loading} variant="outline" className="flex-1 h-9 text-[12px]">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />Save & Add Another
                </Button>
              </div>
              <Button type="button" variant="ghost" onClick={handleMoreOptions} className="h-8 text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />More Options (Advanced Form)
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
