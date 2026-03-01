'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransactionLinkSelector } from './transaction-link-selector';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { getTodayLocalDateString } from '@/lib/utils/local-date';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle2,
  Clock,
  SkipForward,
  Link2,
  Loader2,
  Calendar,
  DollarSign,
  CalendarClock,
  Split,
  Receipt,
} from 'lucide-react';
import type { Bill, BillInstance, Transaction, BillInstanceAllocation } from '@/lib/types';
import type { BillOccurrenceAllocationDto, BillPaymentEventDto } from '@/lib/bills/contracts';
import Decimal from 'decimal.js';

interface BillPayment {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes?: string | null;
  transaction?: { description: string; accountId: string } | null;
}

function mapAllocationDto(allocation: BillOccurrenceAllocationDto): BillInstanceAllocation {
  return {
    id: allocation.id,
    billInstanceId: allocation.occurrenceId,
    billId: allocation.templateId,
    userId: '',
    householdId: allocation.householdId,
    periodNumber: allocation.periodNumber,
    allocatedAmount: allocation.allocatedAmountCents / 100,
    isPaid: allocation.isPaid,
    paidAmount: allocation.paidAmountCents / 100,
    allocationId: allocation.paymentEventId,
    createdAt: allocation.createdAt,
    updatedAt: allocation.updatedAt,
  };
}

interface BillInstanceActionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: BillInstance;
  bill: Bill;
  onSuccess: () => void;
}

export function BillInstanceActionsModal({
  open,
  onOpenChange,
  instance,
  bill,
  onSuccess,
}: BillInstanceActionsModalProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [activeTab, setActiveTab] = useState<'actions' | 'link' | 'period' | 'allocations' | 'payments'>('actions');
  const [loading, setLoading] = useState(false);
  const [periodOverride, setPeriodOverride] = useState<string>(
    instance.budgetPeriodOverride !== undefined && instance.budgetPeriodOverride !== null
      ? String(instance.budgetPeriodOverride)
      : ''
  );
  const [actualAmount, setActualAmount] = useState<string>(
    instance.actualAmount?.toString() || instance.expectedAmount.toString()
  );
  const [notes, setNotes] = useState<string>(instance.notes || '');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(
    instance.transactionId || null
  );
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  // Allocations state
  const [allocations, setAllocations] = useState<BillInstanceAllocation[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [editingAllocations, setEditingAllocations] = useState(false);
  const [allocationInputs, setAllocationInputs] = useState<{ periodNumber: number; amount: string }[]>([
    { periodNumber: 1, amount: '' },
    { periodNumber: 2, amount: '' },
  ]);
  
  // Payments state
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [periodOptionCount, setPeriodOptionCount] = useState(4);
  const [periodFrequency, setPeriodFrequency] = useState('monthly');

  // Fetch allocations when tab is opened
  useEffect(() => {
    if (open && activeTab === 'allocations') {
      fetchAllocations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab]);

  // Fetch payments when tab is opened
  useEffect(() => {
    if (open && activeTab === 'payments') {
      fetchPayments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab]);

  // Fetch budget schedule to render period override options dynamically
  useEffect(() => {
    if (!open || !selectedHouseholdId) return;

    const fetchBudgetSchedule = async () => {
      try {
        const response = await fetchWithHousehold(`/api/budget-schedule?householdId=${selectedHouseholdId}`);
        if (!response.ok) return;
        const data = await response.json();
        setPeriodOptionCount(Math.max(1, data.currentPeriod?.periodsInMonth ?? 4));
        setPeriodFrequency(data.settings?.budgetCycleFrequency || 'monthly');
      } catch (error) {
        console.error('Failed to load budget schedule for period overrides:', error);
      }
    };

    fetchBudgetSchedule();
  }, [open, selectedHouseholdId, fetchWithHousehold]);

  const fetchAllocations = async () => {
    try {
      setLoadingAllocations(true);
      const response = await fetchWithHousehold(`/api/bills/occurrences/${instance.id}/allocations`);
      if (response.ok) {
        const payload = await response.json() as {
          data?: { allocations?: BillOccurrenceAllocationDto[] };
        };
        const mapped = (payload.data?.allocations || []).map(mapAllocationDto);
        setAllocations(mapped);
        
        // Initialize inputs from existing allocations
        if (mapped.length > 0) {
          setAllocationInputs(
            mapped.map((a: BillInstanceAllocation) => ({
              periodNumber: a.periodNumber,
              amount: a.allocatedAmount.toString(),
            }))
          );
        } else {
          // Default to 50/50 split
          const halfAmount = new Decimal(instance.expectedAmount).dividedBy(2).toFixed(2);
          setAllocationInputs([
            { periodNumber: 1, amount: halfAmount },
            { periodNumber: 2, amount: halfAmount },
          ]);
        }
      }
    } catch (error) {
      console.error('Error fetching allocations:', error);
    } finally {
      setLoadingAllocations(false);
    }
  };

  const fetchPayments = async () => {
    try {
      setLoadingPayments(true);
      const response = await fetchWithHousehold(`/api/bills/occurrences/${instance.id}/payments`);
      if (response.ok) {
        const payload = await response.json() as {
          data?: {
            payments: BillPaymentEventDto[];
            related?: {
              transactions?: Array<{ id: string; description: string; accountId: string }>;
            };
          };
        };
        const transactions = payload.data?.related?.transactions || [];
        const txMap = new Map(transactions.map((transaction) => [transaction.id, transaction]));
        setPayments(
          (payload.data?.payments || []).map((payment) => ({
            id: payment.id,
            amount: payment.amountCents / 100,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            notes: payment.notes,
            transaction: txMap.has(payment.transactionId)
              ? {
                  description: txMap.get(payment.transactionId)?.description || '',
                  accountId: txMap.get(payment.transactionId)?.accountId || '',
                }
              : null,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleSaveAllocations = async () => {
    try {
      setLoading(true);
      
      const allocationsData = allocationInputs
        .filter(a => a.amount && parseFloat(a.amount) > 0)
        .map(a => ({
          periodNumber: a.periodNumber,
          allocatedAmountCents: Math.round(parseFloat(a.amount) * 100),
        }));

      const response = await fetchWithHousehold(`/api/bills/occurrences/${instance.id}/allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: allocationsData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save allocations');
      }

      toast.success('Allocations saved successfully');
      setEditingAllocations(false);
      fetchAllocations();
      onSuccess();
    } catch (error) {
      console.error('Error saving allocations:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save allocations');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAllocations = async () => {
    try {
      setLoading(true);
      
      const response = await fetchWithHousehold(`/api/bills/occurrences/${instance.id}/allocations`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove allocations');
      }

      toast.success('Allocations removed');
      setAllocations([]);
      setEditingAllocations(false);
      onSuccess();
    } catch (error) {
      console.error('Error removing allocations:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove allocations');
    } finally {
      setLoading(false);
    }
  };

  const getPeriodOptionLabel = (periodNumber: number): string => {
    if (periodFrequency === 'semi-monthly' && periodOptionCount === 2) {
      return periodNumber === 1 ? 'Period 1 (first half)' : 'Period 2 (second half)';
    }

    if (periodFrequency === 'weekly') {
      return `Week ${periodNumber}`;
    }

    if (periodFrequency === 'biweekly') {
      return `Paycheck ${periodNumber}`;
    }

    return `Period ${periodNumber}`;
  };

  const handleAction = async (action: 'paid' | 'pending' | 'skipped') => {
    try {
      setLoading(true);

      const updateData: Record<string, unknown> = {
        status: action === 'pending' ? 'unpaid' : action,
        notes: notes || undefined,
      };

      if (action === 'paid') {
        updateData.paidDate = getTodayLocalDateString();
        updateData.actualAmountCents = Math.round(
          (actualAmount ? parseFloat(actualAmount) : instance.expectedAmount) * 100
        );
        updateData.isManualOverride = true;
      } else if (action === 'pending') {
        updateData.paidDate = null;
        updateData.actualAmountCents = null;
        updateData.transactionId = null;
        updateData.isManualOverride = false;
      }

      const response = await fetchWithHousehold(`/api/bills/occurrences/${instance.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update bill instance');
      }

      const statusLabels: Record<string, string> = {
        paid: 'marked as paid',
        pending: 'marked as pending',
        skipped: 'skipped',
      };

      toast.success(`Bill instance ${statusLabels[action]}`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating bill instance:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update bill instance');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkTransaction = async () => {
    try {
      setLoading(true);

      const updateData: Record<string, unknown> = {
        transactionId: selectedTransactionId,
        notes: notes || undefined,
      };

      if (selectedTransactionId && selectedTransaction) {
        updateData.status = 'paid';
        updateData.paidDate = selectedTransaction.date;
        updateData.actualAmountCents = Math.round(selectedTransaction.amount * 100);
        updateData.isManualOverride = true;
      } else {
        updateData.transactionId = null;
      }

      const response = await fetchWithHousehold(`/api/bills/occurrences/${instance.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update bill instance');
      }

      if (selectedTransactionId) {
        toast.success('Transaction linked and bill marked as paid');
      } else {
        toast.success('Transaction unlinked from bill instance');
      }
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error linking transaction:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to link transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionSelect = (transactionId: string | null, transaction: Transaction | null) => {
    setSelectedTransactionId(transactionId);
    setSelectedTransaction(transaction);
  };

  const handlePeriodOverride = async () => {
    try {
      setLoading(true);

      const updateData: Record<string, unknown> = {
        budgetPeriodOverride: periodOverride ? parseInt(periodOverride) : null,
      };

      const response = await fetchWithHousehold(`/api/bills/occurrences/${instance.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update period assignment');
      }

      toast.success(periodOverride ? 'Period assignment updated' : 'Period assignment cleared');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating period assignment:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update period assignment');
    } finally {
      setLoading(false);
    }
  };

  const isPending = instance.status === 'pending';
  const isOverdue = instance.status === 'overdue';
  const isPaid = instance.status === 'paid';
  const isSkipped = instance.status === 'skipped';
  const isPartiallyPaid = instance.paymentStatus === 'partial';

  // Calculate allocation total
  const allocationTotal = allocationInputs.reduce(
    (sum, a) => sum + (parseFloat(a.amount) || 0),
    0
  );
  const allocationDifference = new Decimal(instance.expectedAmount).minus(allocationTotal);
  const isAllocationValid = allocationDifference.abs().lessThanOrEqualTo(0.01);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto border"
        style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-foreground)' }}>Manage Bill Instance</DialogTitle>
          <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>
            {bill.name} - Due {format(parseISO(instance.dueDate), 'MMMM d, yyyy')}
            {isPartiallyPaid && (
              <span className="ml-2" style={{ color: 'var(--color-warning)' }}>(Partially Paid)</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-5" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="link">Link</TabsTrigger>
            <TabsTrigger value="allocations">Split</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="period">Period</TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="space-y-4 mt-4">
            {/* Instance Info */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)' }}>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Due Date</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                    {format(parseISO(instance.dueDate), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Expected Amount</p>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                    ${instance.expectedAmount.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Partial Payment Progress */}
            {isPartiallyPaid && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)' }}>
                <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--color-muted-foreground)' }}>
                  <span>Paid: ${new Decimal(instance.paidAmount || 0).toFixed(2)}</span>
                  <span>Remaining: ${new Decimal(instance.remainingAmount || 0).toFixed(2)}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
<div
                    className="h-full transition-all duration-300"
                    style={{ 
                      backgroundColor: 'var(--color-success)',
                      width: `${((instance.paidAmount || 0) / instance.expectedAmount) * 100}%` 
                    }}
                  />
                </div>
              </div>
            )}

            {/* Actual Amount Input (for marking as paid) */}
            {(isPending || isOverdue || isPartiallyPaid) && (
              <div className="space-y-2">
                <Label htmlFor="actualAmount" style={{ color: 'var(--color-foreground)' }}>
                  {isPartiallyPaid ? 'Additional Payment Amount' : 'Actual Amount (optional)'}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted-foreground)' }}>
                    $
                  </span>
                  <Input
                    id="actualAmount"
                    type="number"
                    step="0.01"
                    value={actualAmount}
                    onChange={(e) => setActualAmount(e.target.value)}
                    className="pl-7"
                    style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
                    placeholder={isPartiallyPaid 
                      ? (instance.remainingAmount || 0).toFixed(2)
                      : instance.expectedAmount.toFixed(2)
                    }
                  />
                </div>
              </div>
            )}

            {/* Notes Input */}
            <div className="space-y-2">
              <Label htmlFor="notes" style={{ color: 'var(--color-foreground)' }}>
                Notes
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
                style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
                placeholder="Add a note..."
                rows={2}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {(isPending || isOverdue || isPartiallyPaid) && (
                <>
                  <Button
                    onClick={() => handleAction('paid')}
                    disabled={loading}
                    className="flex-1 hover:opacity-90"
                    style={{ backgroundColor: 'var(--color-success)', color: 'white' }}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    {isPartiallyPaid ? 'Mark Fully Paid' : 'Mark as Paid'}
                  </Button>
                  {!isPartiallyPaid && (
                    <Button
                      onClick={() => handleAction('skipped')}
                      disabled={loading}
                      variant="outline"
                      className="flex-1 border hover:bg-[var(--color-elevated)]"
                    style={{ borderColor: 'var(--color-border)' }}
                    >
                      <SkipForward className="w-4 h-4 mr-2" />
                      Skip
                    </Button>
                  )}
                </>
              )}
              
              {isPaid && (
                <Button
                  onClick={() => handleAction('pending')}
                  disabled={loading}
                  variant="outline"
                  className="flex-1 border hover:bg-[var(--color-elevated)]"
                    style={{ borderColor: 'var(--color-border)' }}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4 mr-2" />
                  )}
                  Mark as Pending
                </Button>
              )}

              {isSkipped && (
                <Button
                  onClick={() => handleAction('pending')}
                  disabled={loading}
                  variant="outline"
                  className="flex-1 border hover:bg-[var(--color-elevated)]"
                    style={{ borderColor: 'var(--color-border)' }}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Clock className="w-4 h-4 mr-2" />
                  )}
                  Mark as Pending
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="link" className="space-y-4 mt-4">
            <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              Link an existing expense transaction to this bill instance.
            </p>

            <TransactionLinkSelector
              expectedAmount={instance.expectedAmount}
              dueDate={instance.dueDate}
              amountTolerance={bill.amountTolerance}
              currentTransactionId={instance.transactionId}
              onSelect={handleTransactionSelect}
              selectedId={selectedTransactionId}
            />

            <Button
              onClick={handleLinkTransaction}
              disabled={loading || (selectedTransactionId === instance.transactionId)}
              className="w-full hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              {selectedTransactionId ? 'Link & Mark as Paid' : 'Unlink Transaction'}
            </Button>
          </TabsContent>

          <TabsContent value="allocations" className="space-y-4 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Split className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                Split this bill across budget periods for partial payments.
              </p>
            </div>

            {loadingAllocations ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-muted-foreground)' }} />
              </div>
            ) : (
              <>
                {/* Current Allocations Display */}
                {allocations.length > 0 && !editingAllocations && (
                  <div className="space-y-2 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)' }}>
                    <p className="text-xs mb-2" style={{ color: 'var(--color-muted-foreground)' }}>Current Split:</p>
                    {allocations.map(a => (
                      <div 
                        key={a.id}
                        className="flex justify-between items-center text-sm"
                      >
                        <span style={{ color: 'var(--color-foreground)' }}>Period {a.periodNumber}</span>
                        <span className="font-mono" style={{ color: 'var(--color-foreground)' }}>
                          ${new Decimal(a.paidAmount || 0).toFixed(2)} / ${new Decimal(a.allocatedAmount).toFixed(2)}
                          {a.isPaid && (
                            <CheckCircle2 className="w-4 h-4 ml-2 inline" style={{ color: 'var(--color-success)' }} />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Edit Allocations Form */}
                {(allocations.length === 0 || editingAllocations) && (
                  <div className="space-y-3 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)' }}>
                    <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                      Set amount for each period (must equal ${instance.expectedAmount.toFixed(2)}):
                    </p>
                    {allocationInputs.map((input, index) => (
                      <div key={input.periodNumber} className="flex items-center gap-3">
                        <span className="text-sm w-20" style={{ color: 'var(--color-muted-foreground)' }}>
                          Period {input.periodNumber}
                        </span>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted-foreground)' }}>
                            $
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            value={input.amount}
                            onChange={(e) => {
                              const newInputs = [...allocationInputs];
                              newInputs[index].amount = e.target.value;
                              setAllocationInputs(newInputs);
                            }}
                            className="pl-7"
                    style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
                          />
                        </div>
                      </div>
                    ))}
                    
                    {/* Validation Message */}
                    <div className="text-xs" style={{ color: isAllocationValid ? 'var(--color-success)' : 'var(--color-destructive)' }}>
                      Total: ${allocationTotal.toFixed(2)}
                      {!isAllocationValid && (
                        <span className="ml-2">
                          (${allocationDifference.abs().toFixed(2)} {allocationDifference.greaterThan(0) ? 'remaining' : 'over'})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {allocations.length > 0 && !editingAllocations ? (
                    <>
                      <Button
                        onClick={() => setEditingAllocations(true)}
                        variant="outline"
                        className="flex-1 border"
                    style={{ borderColor: 'var(--color-border)' }}
                      >
                        Edit Split
                      </Button>
                      <Button
                        onClick={handleRemoveAllocations}
                        disabled={loading || allocations.some(a => a.isPaid)}
                        variant="outline"
                        className="flex-1 border hover:opacity-80"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-destructive)' }}
                      >
                        Remove Split
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={handleSaveAllocations}
                        disabled={loading || !isAllocationValid}
                        className="flex-1 hover:opacity-90"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Split className="w-4 h-4 mr-2" />
                        )}
                        Save Split
                      </Button>
                      {editingAllocations && (
                        <Button
                          onClick={() => {
                            setEditingAllocations(false);
                            fetchAllocations();
                          }}
                          variant="outline"
                          className="border"
                    style={{ borderColor: 'var(--color-border)' }}
                        >
                          Cancel
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="payments" className="space-y-4 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                Payment history for this bill instance.
              </p>
            </div>

            {loadingPayments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-muted-foreground)' }} />
              </div>
            ) : payments.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--color-muted-foreground)' }}>
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No payments recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map(payment => (
                  <div 
                    key={payment.id}
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--color-elevated)' }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                          ${new Decimal(payment.amount).toFixed(2)}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                          {format(parseISO(payment.paymentDate), 'MMM d, yyyy')}
                          {payment.paymentMethod && ` - ${payment.paymentMethod}`}
                        </p>
                      </div>
                      <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                    </div>
                    {payment.notes && (
                      <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                        {payment.notes}
                      </p>
                    )}
                  </div>
                ))}
                
                {/* Summary */}
                <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--color-muted-foreground)' }}>Total Paid</span>
                    <span className="font-mono" style={{ color: 'var(--color-foreground)' }}>
                      ${payments.reduce((sum, p) => new Decimal(sum).plus(p.amount).toNumber(), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span style={{ color: 'var(--color-muted-foreground)' }}>Expected</span>
                    <span className="font-mono" style={{ color: 'var(--color-foreground)' }}>
                      ${instance.expectedAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="period" className="space-y-4 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarClock className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                Override which budget period this instance appears in.
              </p>
            </div>

            <div className="space-y-2">
              <Label style={{ color: 'var(--color-foreground)' }}>Period Assignment</Label>
              <Select value={periodOverride} onValueChange={setPeriodOverride}>
                <SelectTrigger style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
                  <SelectValue placeholder="Use bill default or due date" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
                  <SelectItem value="">Use bill default or due date</SelectItem>
                  {Array.from({ length: periodOptionCount }, (_, index) => {
                    const periodNumber = index + 1;
                    return (
                      <SelectItem key={periodNumber} value={String(periodNumber)}>
                        {getPeriodOptionLabel(periodNumber)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                This override only affects this specific instance.
              </p>
            </div>

            <Button
              onClick={handlePeriodOverride}
              disabled={loading}
              className="w-full hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CalendarClock className="w-4 h-4 mr-2" />
              )}
              Save Period Assignment
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
