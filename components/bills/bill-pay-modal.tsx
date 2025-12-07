'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Loader2,
  CreditCard,
  ArrowDownCircle,
} from 'lucide-react';
import { BillPayForm } from './bill-pay-form';
import Decimal from 'decimal.js';

interface BillInstance {
  id: string;
  billId: string;
  dueDate: string;
  expectedAmount: number;
  actualAmount?: number;
  status: 'pending' | 'paid' | 'overdue' | 'skipped';
  budgetPeriodOverride?: number | null;
}

interface Bill {
  id: string;
  name: string;
  categoryId?: string;
  merchantId?: string;
  accountId?: string;
  expectedAmount: number;
  frequency: string;
  billType?: 'expense' | 'income' | 'savings_transfer';
  budgetPeriodAssignment?: number | null;
}

interface Category {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance?: number;
}

interface BillWithInstance {
  instance: BillInstance;
  bill: Bill;
  category?: Category | null;
  account?: Account | null;
  periodAssignment: {
    isOverride: boolean;
    isBillDefault: boolean;
    isAutomatic: boolean;
  };
}

interface PeriodInfo {
  start: string;
  end: string;
  periodNumber: number;
  periodsInMonth: number;
  label: string;
  offset: number;
}

interface NavigationInfo {
  previous: { label: string; offset: number };
  next: { label: string; offset: number };
}

interface BillPayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBillPaid?: () => void;
}

export function BillPayModal({ open, onOpenChange, onBillPaid }: BillPayModalProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold } = useHouseholdFetch();

  const [loading, setLoading] = useState(true);
  const [periodOffset, setPeriodOffset] = useState(0);
  const [period, setPeriod] = useState<PeriodInfo | null>(null);
  const [navigation, setNavigation] = useState<NavigationInfo | null>(null);
  const [bills, setBills] = useState<BillWithInstance[]>([]);
  const [summary, setSummary] = useState({
    totalBills: 0,
    totalAmount: 0,
    pendingCount: 0,
    overdueCount: 0,
    paidCount: 0,
    pendingAmount: 0,
    paidAmount: 0,
  });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  const fetchBillsByPeriod = useCallback(async () => {
    if (!selectedHouseholdId) return;

    try {
      setLoading(true);
      const response = await fetchWithHousehold(
        `/api/bills/by-period?periodOffset=${periodOffset}&status=pending,overdue,paid`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch bills');
      }

      const data = await response.json();
      setPeriod(data.period);
      setNavigation(data.navigation);
      setBills(data.data);
      setSummary(data.summary);
    } catch (error) {
      console.error('Error fetching bills by period:', error);
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, periodOffset, fetchWithHousehold]);

  const fetchAccounts = useCallback(async () => {
    if (!selectedHouseholdId) return;

    try {
      const response = await fetchWithHousehold('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    if (open) {
      fetchBillsByPeriod();
      fetchAccounts();
    }
  }, [open, fetchBillsByPeriod, fetchAccounts]);

  const handlePay = async (instanceId: string, accountId: string, amount: number) => {
    try {
      setProcessingPayment(true);
      const response = await postWithHousehold(`/api/bills/instances/${instanceId}/pay`, {
        accountId,
        amount,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to pay bill');
      }

      toast.success('Bill paid successfully');
      setPayingBillId(null);
      
      // Refresh the bills list
      await fetchBillsByPeriod();
      
      // Notify parent component
      onBillPaid?.();
    } catch (error) {
      console.error('Error paying bill:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to pay bill');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleMarkPaid = async (instanceId: string) => {
    try {
      setProcessingPayment(true);
      const response = await fetchWithHousehold(`/api/bills/instances/${instanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'paid',
          paidDate: format(new Date(), 'yyyy-MM-dd'),
          isManualOverride: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark bill as paid');
      }

      toast.success('Bill marked as paid');
      await fetchBillsByPeriod();
      onBillPaid?.();
    } catch (error) {
      console.error('Error marking bill as paid:', error);
      toast.error('Failed to mark bill as paid');
    } finally {
      setProcessingPayment(false);
    }
  };

  const unpaidBills = bills.filter(
    (b) => b.instance.status === 'pending' || b.instance.status === 'overdue'
  );
  const paidBills = bills.filter((b) => b.instance.status === 'paid');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[var(--color-primary)]" />
            Bill Pay
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Pay bills for the selected budget period
          </DialogDescription>
        </DialogHeader>

        {/* Period Navigation */}
        <div className="flex items-center justify-between px-4 py-3 bg-elevated rounded-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPeriodOffset(periodOffset - 1)}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {navigation?.previous.label || 'Previous'}
          </Button>

          <div className="text-center">
            <p className="font-medium text-foreground">
              {period?.label || 'Loading...'}
            </p>
            <p className="text-xs text-muted-foreground">
              {period && `${format(parseISO(period.start), 'MMM d')} - ${format(parseISO(period.end), 'MMM d')}`}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPeriodOffset(periodOffset + 1)}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground"
          >
            {navigation?.next.label || 'Next'}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 px-1">
          <div className="bg-elevated rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Due</p>
            <p className="text-lg font-bold text-[var(--color-warning)]">
              ${new Decimal(summary.pendingAmount).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.pendingCount + summary.overdueCount} bills
            </p>
          </div>
          <div className="bg-elevated rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-lg font-bold text-[var(--color-error)]">
              {summary.overdueCount}
            </p>
            <p className="text-xs text-muted-foreground">bills</p>
          </div>
          <div className="bg-elevated rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-[var(--color-income)]">
              ${new Decimal(summary.paidAmount).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.paidCount} bills
            </p>
          </div>
        </div>

        {/* Bills List */}
        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Unpaid Bills */}
              {unpaidBills.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Bills Due ({unpaidBills.length})
                  </h3>
                  <div className="space-y-2">
                    {unpaidBills.map((item) => (
                      <BillItem
                        key={item.instance.id}
                        item={item}
                        accounts={accounts}
                        isPayFormOpen={payingBillId === item.instance.id}
                        onOpenPayForm={() => setPayingBillId(item.instance.id)}
                        onClosePayForm={() => setPayingBillId(null)}
                        onPay={handlePay}
                        onMarkPaid={handleMarkPaid}
                        processing={processingPayment}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Paid Bills */}
              {paidBills.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[var(--color-income)]" />
                    Paid This Period ({paidBills.length})
                  </h3>
                  <div className="space-y-2 opacity-75">
                    {paidBills.map((item) => (
                      <div
                        key={item.instance.id}
                        className="flex items-center justify-between p-3 bg-elevated rounded-lg border border-[var(--color-income)]/20"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-[var(--color-income)]" />
                          <div>
                            <p className="font-medium text-foreground">{item.bill.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Paid {item.instance.actualAmount ? `$${new Decimal(item.instance.actualAmount).toFixed(2)}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {unpaidBills.length === 0 && paidBills.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-[var(--color-income)] mx-auto mb-3" />
                  <p className="text-foreground font-medium">No bills for this period</p>
                  <p className="text-sm text-muted-foreground">
                    All caught up! Use the arrows to navigate to other periods.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BillItemProps {
  item: BillWithInstance;
  accounts: Account[];
  isPayFormOpen: boolean;
  onOpenPayForm: () => void;
  onClosePayForm: () => void;
  onPay: (instanceId: string, accountId: string, amount: number) => void;
  onMarkPaid: (instanceId: string) => void;
  processing: boolean;
}

function BillItem({
  item,
  accounts,
  isPayFormOpen,
  onOpenPayForm,
  onClosePayForm,
  onPay,
  onMarkPaid,
  processing,
}: BillItemProps) {
  const isOverdue = item.instance.status === 'overdue';
  const isIncome = item.bill.billType === 'income';
  const dueDate = parseISO(item.instance.dueDate);

  return (
    <div
      className={`rounded-lg border transition-all ${
        isPayFormOpen
          ? 'bg-card border-[var(--color-primary)]'
          : isOverdue
          ? 'bg-elevated border-[var(--color-error)]/30'
          : 'bg-elevated border-border'
      }`}
    >
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="mt-0.5">
            {isOverdue ? (
              <AlertCircle className="w-5 h-5 text-[var(--color-error)]" />
            ) : isIncome ? (
              <ArrowDownCircle className="w-5 h-5 text-[var(--color-income)]/50" />
            ) : (
              <Clock className="w-5 h-5 text-[var(--color-warning)]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground truncate">{item.bill.name}</p>
              {item.periodAssignment.isOverride && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  Override
                </span>
              )}
              {item.periodAssignment.isBillDefault && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  Fixed
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isIncome ? 'Expected' : 'Due'}: {format(dueDate, 'MMM d')}
              {item.category && ` - ${item.category.name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className={`font-medium ${isIncome ? 'text-[var(--color-income)]' : 'text-foreground'}`}>
            {isIncome ? '+' : ''}${new Decimal(item.instance.expectedAmount).toFixed(2)}
          </p>
          {!isPayFormOpen && (
            <Button
              size="sm"
              onClick={onOpenPayForm}
              disabled={processing}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
            >
              <DollarSign className="w-4 h-4 mr-1" />
              Pay
            </Button>
          )}
        </div>
      </div>

      {/* Pay Form */}
      {isPayFormOpen && (
        <div className="border-t border-border p-3">
          <BillPayForm
            instance={item.instance}
            bill={item.bill}
            accounts={accounts}
            defaultAccountId={item.bill.accountId || item.account?.id}
            onPay={(accountId, amount) => onPay(item.instance.id, accountId, amount)}
            onMarkPaid={() => onMarkPaid(item.instance.id)}
            onCancel={onClosePayForm}
            processing={processing}
          />
        </div>
      )}
    </div>
  );
}
