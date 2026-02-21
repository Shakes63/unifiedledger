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
        expectedAmount: parsedAmount,
        frequency,
        dueDate: parsedDueDate,
        categoryId: categoryId || null,
        billType: 'expense',
        autoMarkPaid: true,
      };

      // Add classification if we have a high-confidence suggestion
      if (suggestion && suggestion.confidence >= 0.7) {
        billData.billClassification = suggestion.classification;
        if (suggestion.subcategory) {
          billData.classificationSubcategory = suggestion.subcategory;
        }
      }

      const response = await fetchWithHousehold('/api/bills-v2', {
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

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Quick Add Bill
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a recurring expense quickly. For advanced options, use the full form.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(false);
            }}
            className="space-y-4 mt-2"
          >
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="quick-add-bill-name" className="text-foreground">
                Bill Name
              </Label>
              <Input
                id="quick-add-bill-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Netflix, Electric Bill"
                className="bg-elevated border-border"
                autoFocus
              />
              {/* Classification Suggestion */}
              {suggestion && suggestion.confidence >= 0.7 && (
                <div
                  className="p-2 rounded-lg border flex items-center justify-between gap-2"
                  style={{
                    backgroundColor: `${CLASSIFICATION_META[suggestion.classification].color}10`,
                    borderColor: `${CLASSIFICATION_META[suggestion.classification].color}30`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: CLASSIFICATION_META[suggestion.classification].color }}
                    />
                    <span
                      className="text-xs"
                      style={{ color: CLASSIFICATION_META[suggestion.classification].color }}
                    >
                      Auto: <strong>{CLASSIFICATION_META[suggestion.classification].label}</strong>
                      {suggestion.subcategory && (
                        <span className="opacity-80">
                          {' '}
                          ({formatSubcategory(suggestion.subcategory)})
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSuggestion(null);
                      setSuggestionDismissed(true);
                    }}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="quick-add-bill-amount" className="text-foreground">
                Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="quick-add-bill-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-7 bg-elevated border-border"
                />
              </div>
            </div>

            {/* Frequency and Due Date Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-foreground">Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger className="bg-elevated border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {QUICK_ADD_FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">
                  {isWeekBased ? 'Day of Week' : 'Day of Month'}
                </Label>
                {isWeekBased ? (
                  <Select value={dueDate} onValueChange={setDueDate}>
                    <SelectTrigger className="bg-elevated border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {DAY_OF_WEEK_OPTIONS.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    placeholder="1"
                    className="bg-elevated border-border"
                  />
                )}
              </div>
            </div>

            {/* Category (Optional) */}
            <div className="space-y-2">
              <Label className="text-foreground">
                Category <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Select value={categoryId || 'none'} onValueChange={(val) => setCategoryId(val === 'none' ? '' : val)}>
                <SelectTrigger className="bg-elevated border-border">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                  variant="outline"
                  className="flex-1 border-border"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Save & Add Another
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={handleMoreOptions}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                More Options (Advanced Form)
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Discard Confirmation */}
      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Discard changes?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              You have unsaved changes. Are you sure you want to close without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDiscard}
              className="bg-error hover:bg-error/90 text-white"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
