'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import type { Bill, BillInstance, Transaction } from '@/lib/types';

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
  const { fetchWithHousehold } = useHouseholdFetch();
  const [activeTab, setActiveTab] = useState<'actions' | 'link' | 'period'>('actions');
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

  const handleAction = async (action: 'paid' | 'pending' | 'skipped') => {
    try {
      setLoading(true);

      const updateData: Record<string, unknown> = {
        status: action,
        notes: notes || undefined,
      };

      if (action === 'paid') {
        updateData.paidDate = new Date().toISOString().split('T')[0];
        updateData.actualAmount = actualAmount ? parseFloat(actualAmount) : instance.expectedAmount;
        updateData.isManualOverride = true;
      } else if (action === 'pending') {
        // Reset paid-related fields
        updateData.paidDate = null;
        updateData.actualAmount = null;
        updateData.transactionId = null;
        updateData.isManualOverride = false;
      }

      const response = await fetchWithHousehold(`/api/bills/instances/${instance.id}`, {
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

      // If linking to a transaction, auto-mark as paid
      if (selectedTransactionId && selectedTransaction) {
        updateData.status = 'paid';
        updateData.paidDate = selectedTransaction.date;
        updateData.actualAmount = selectedTransaction.amount;
        updateData.isManualOverride = true;
      } else {
        // Unlinking - just clear the transaction link
        updateData.transactionId = null;
      }

      const response = await fetchWithHousehold(`/api/bills/instances/${instance.id}`, {
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

      const response = await fetchWithHousehold(`/api/bills/instances/${instance.id}`, {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Manage Bill Instance</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {bill.name} - Due {format(parseISO(instance.dueDate), 'MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'actions' | 'link' | 'period')}>
          <TabsList className="grid w-full grid-cols-3 bg-elevated">
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="link">Link</TabsTrigger>
            <TabsTrigger value="period">Period</TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="space-y-4 mt-4">
            {/* Instance Info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-elevated rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(parseISO(instance.dueDate), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Expected Amount</p>
                  <p className="text-sm font-medium text-foreground">
                    ${instance.expectedAmount.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Actual Amount Input (for marking as paid) */}
            {(isPending || isOverdue) && (
              <div className="space-y-2">
                <Label htmlFor="actualAmount" className="text-foreground">
                  Actual Amount (optional)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="actualAmount"
                    type="number"
                    step="0.01"
                    value={actualAmount}
                    onChange={(e) => setActualAmount(e.target.value)}
                    className="pl-7 bg-background border-border"
                    placeholder={instance.expectedAmount.toFixed(2)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave blank to use expected amount
                </p>
              </div>
            )}

            {/* Notes Input */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-foreground">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-background border-border resize-none"
                placeholder="Add a note..."
                rows={2}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {(isPending || isOverdue) && (
                <>
                  <Button
                    onClick={() => handleAction('paid')}
                    disabled={loading}
                    className="flex-1 bg-success hover:bg-success/90 text-white"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Mark as Paid
                  </Button>
                  <Button
                    onClick={() => handleAction('skipped')}
                    disabled={loading}
                    variant="outline"
                    className="flex-1 border-border hover:bg-elevated"
                  >
                    <SkipForward className="w-4 h-4 mr-2" />
                    Skip
                  </Button>
                </>
              )}
              
              {isPaid && (
                <Button
                  onClick={() => handleAction('pending')}
                  disabled={loading}
                  variant="outline"
                  className="flex-1 border-border hover:bg-elevated"
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
                  className="flex-1 border-border hover:bg-elevated"
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
            <p className="text-sm text-muted-foreground">
              Link an existing expense transaction to this bill instance. The bill will be automatically marked as paid.
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
              className="w-full bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              {selectedTransactionId ? 'Link & Mark as Paid' : 'Unlink Transaction'}
            </Button>
          </TabsContent>

          <TabsContent value="period" className="space-y-4 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarClock className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Override which budget period this instance appears in for Bill Pay.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Period Assignment</Label>
              <Select value={periodOverride} onValueChange={setPeriodOverride}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Use bill default or due date" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="">Use bill default or due date</SelectItem>
                  <SelectItem value="1">Period 1 (first half)</SelectItem>
                  <SelectItem value="2">Period 2 (second half)</SelectItem>
                  <SelectItem value="3">Period 3</SelectItem>
                  <SelectItem value="4">Period 4</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This override only affects this specific instance, not the bill itself.
              </p>
            </div>

            <Button
              onClick={handlePeriodOverride}
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90"
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

