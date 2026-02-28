'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, parseISO, subDays } from 'date-fns';
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
  Split,
} from 'lucide-react';
import { BillPayForm } from './bill-pay-form';
import Decimal from 'decimal.js';
import type { BillInstanceAllocation } from '@/lib/types';
import type {
  BillOccurrenceAllocationDto,
  BillOccurrenceWithTemplateDto,
  RecurrenceType,
} from '@/lib/bills/contracts';
import {
  getCurrentBudgetPeriod,
  getDefaultBudgetScheduleSettings,
  getNextBudgetPeriod,
  getPeriodLabel,
  type BudgetCycleFrequency,
  type BudgetPeriod,
  type BudgetScheduleSettings,
} from '@/lib/budgets/budget-schedule';

interface BillInstance {
  id: string;
  billId: string;
  dueDate: string;
  expectedAmount: number;
  actualAmount?: number | null;
  status: 'pending' | 'paid' | 'overdue' | 'skipped';
  budgetPeriodOverride?: number | null;
  paidAmount?: number;
  remainingAmount?: number | null;
  paymentStatus?: 'unpaid' | 'partial' | 'paid' | 'overpaid';
}

interface Bill {
  id: string;
  name: string;
  categoryId?: string | null;
  merchantId?: string | null;
  accountId?: string | null;
  expectedAmount: number;
  frequency: string;
  billType?: 'expense' | 'income' | 'savings_transfer';
  budgetPeriodAssignment?: number | null;
  splitAcrossPeriods?: boolean;
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
    isSplitAllocation?: boolean;
  };
  // Allocation data from API
  allocation?: BillInstanceAllocation | null;
  allAllocations?: BillInstanceAllocation[];
  isSplit?: boolean;
  displayAmount?: number;
  displayPaidAmount?: number;
  displayRemainingAmount?: number;
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

function getPeriodByOffset(settings: BudgetScheduleSettings, offset: number): BudgetPeriod {
  let period = getCurrentBudgetPeriod(settings);

  if (offset > 0) {
    for (let index = 0; index < offset; index += 1) {
      period = getNextBudgetPeriod(settings, period.end);
    }
  } else if (offset < 0) {
    for (let index = 0; index < Math.abs(offset); index += 1) {
      period = getCurrentBudgetPeriod(settings, subDays(period.start, 1));
    }
  }

  return period;
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

function toFrequency(recurrenceType: RecurrenceType): string {
  if (recurrenceType === 'one_time') return 'one-time';
  if (recurrenceType === 'semi_annual') return 'semi-annual';
  return recurrenceType;
}

function mapRow(row: BillOccurrenceWithTemplateDto): { bill: Bill; instance: BillInstance } {
  const template = row.template;
  const occurrence = row.occurrence;
  return {
    bill: {
      id: template.id,
      name: template.name,
      categoryId: template.categoryId,
      merchantId: template.merchantId,
      accountId: template.paymentAccountId,
      expectedAmount: template.defaultAmountCents / 100,
      frequency: toFrequency(template.recurrenceType),
      billType: template.billType,
      budgetPeriodAssignment: template.budgetPeriodAssignment,
      splitAcrossPeriods: template.splitAcrossPeriods,
    },
    instance: {
      id: occurrence.id,
      billId: occurrence.templateId,
      dueDate: occurrence.dueDate,
      expectedAmount: occurrence.amountDueCents / 100,
      actualAmount:
        occurrence.actualAmountCents !== null ? occurrence.actualAmountCents / 100 : null,
      status:
        occurrence.status === 'paid' || occurrence.status === 'overpaid'
          ? 'paid'
          : occurrence.status === 'overdue'
            ? 'overdue'
            : occurrence.status === 'skipped'
              ? 'skipped'
              : 'pending',
      budgetPeriodOverride: occurrence.budgetPeriodOverride,
      paidAmount: occurrence.amountPaidCents / 100,
      remainingAmount: occurrence.amountRemainingCents / 100,
      paymentStatus:
        occurrence.status === 'paid'
          ? 'paid'
          : occurrence.status === 'overpaid'
            ? 'overpaid'
            : occurrence.status === 'partial'
              ? 'partial'
              : 'unpaid',
    },
  };
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
      const [scheduleResponse, occurrencesResponse, categoriesResponse] = await Promise.all([
        fetchWithHousehold(`/api/budget-schedule?householdId=${selectedHouseholdId}`),
        fetchWithHousehold(
          `/api/bills/occurrences?periodOffset=${periodOffset}&status=unpaid,partial,overdue,paid&limit=5000`
        ),
        fetchWithHousehold('/api/categories'),
      ]);

      if (!scheduleResponse.ok || !occurrencesResponse.ok) {
        throw new Error('Failed to fetch bills');
      }

      const scheduleData = await scheduleResponse.json();
      const occurrencesData = await occurrencesResponse.json();
      const categoriesData = categoriesResponse.ok ? await categoriesResponse.json() : [];

      const settings: BudgetScheduleSettings = {
        ...getDefaultBudgetScheduleSettings(),
        ...(scheduleData?.settings || {}),
      };
      const frequency =
        (settings.budgetCycleFrequency as BudgetCycleFrequency | undefined) || 'monthly';

      const currentPeriod = getPeriodByOffset(settings, periodOffset);
      const previousPeriod = getPeriodByOffset(settings, periodOffset - 1);
      const nextPeriod = getPeriodByOffset(settings, periodOffset + 1);

      setPeriod({
        start: currentPeriod.startStr,
        end: currentPeriod.endStr,
        periodNumber: currentPeriod.periodNumber,
        periodsInMonth: currentPeriod.periodsInMonth,
        label: getPeriodLabel(currentPeriod, frequency),
        offset: periodOffset,
      });
      setNavigation({
        previous: {
          label: getPeriodLabel(previousPeriod, frequency),
          offset: periodOffset - 1,
        },
        next: {
          label: getPeriodLabel(nextPeriod, frequency),
          offset: periodOffset + 1,
        },
      });

      const categoryRows: Category[] = Array.isArray(categoriesData)
        ? categoriesData
        : Array.isArray(categoriesData?.data)
          ? categoriesData.data
          : [];
      const categoryMap = new Map(categoryRows.map((category) => [category.id, category]));

      const rows: BillOccurrenceWithTemplateDto[] = Array.isArray(occurrencesData?.data)
        ? occurrencesData.data
        : [];

      const mappedBills: BillWithInstance[] = rows.map((row) => {
        const { bill, instance } = mapRow(row);
        const allAllocations = row.allocations.map(mapAllocationDto);
        const allocation =
          allAllocations.find((item) => item.periodNumber === currentPeriod.periodNumber) || null;
        const displayAmount = allocation ? allocation.allocatedAmount : instance.expectedAmount;
        const displayPaidAmount = allocation ? allocation.paidAmount : instance.paidAmount || 0;
        const displayRemainingAmount = Math.max(0, displayAmount - displayPaidAmount);

        return {
          instance,
          bill,
          category: bill.categoryId ? categoryMap.get(bill.categoryId) || null : null,
          account: null,
          allocation,
          allAllocations,
          isSplit: allAllocations.length > 1 || !!bill.splitAcrossPeriods,
          periodAssignment: {
            isOverride:
              instance.budgetPeriodOverride !== null &&
              instance.budgetPeriodOverride !== undefined,
            isBillDefault:
              bill.budgetPeriodAssignment !== null &&
              (instance.budgetPeriodOverride === null ||
                instance.budgetPeriodOverride === undefined),
            isAutomatic:
              (instance.budgetPeriodOverride === null ||
                instance.budgetPeriodOverride === undefined) &&
              bill.budgetPeriodAssignment === null,
            isSplitAllocation: allocation !== null,
          },
          displayAmount,
          displayPaidAmount,
          displayRemainingAmount,
        };
      });

      setBills(mappedBills);
      setSummary({
        totalBills: mappedBills.length,
        totalAmount: mappedBills.reduce((sum, row) => sum + (row.displayAmount || 0), 0),
        pendingCount: mappedBills.filter((row) =>
          row.allocation ? !row.allocation.isPaid : row.instance.status === 'pending'
        ).length,
        overdueCount: mappedBills.filter((row) => row.instance.status === 'overdue').length,
        paidCount: mappedBills.filter((row) =>
          row.allocation ? row.allocation.isPaid : row.instance.status === 'paid'
        ).length,
        pendingAmount: mappedBills
          .filter((row) =>
            row.allocation
              ? !row.allocation.isPaid
              : row.instance.status === 'pending' || row.instance.status === 'overdue'
          )
          .reduce((sum, row) => sum + (row.displayRemainingAmount || 0), 0),
        paidAmount: mappedBills
          .filter((row) =>
            row.allocation ? row.allocation.isPaid : row.instance.status === 'paid'
          )
          .reduce((sum, row) => sum + (row.displayPaidAmount || 0), 0),
      });
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

  const handlePay = async (instanceId: string, accountId: string, amount: number, allocationId?: string) => {
    try {
      setProcessingPayment(true);
      const response = await postWithHousehold(`/api/bills/occurrences/${instanceId}/pay`, {
        accountId,
        amount,
        allocationId,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to pay bill');
      }

      const result = await response.json();
      
      // Show different toast based on payment status
      const paymentStatus = result.payment?.paymentStatus ?? result.data?.occurrence?.status;
      if (paymentStatus === 'partial') {
        toast.success(`Partial payment of $${new Decimal(amount).toFixed(2)} recorded`);
      } else {
        toast.success('Bill paid successfully');
      }
      
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
      const response = await fetchWithHousehold(`/api/bills/occurrences/${instanceId}`, {
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

  // Filter bills based on payment status for this period
  const unpaidBills = bills.filter((b) => {
    // If has allocation, check allocation paid status
    if (b.allocation) {
      return !b.allocation.isPaid;
    }
    return b.instance.status === 'pending' || b.instance.status === 'overdue';
  });
  
  const paidBills = bills.filter((b) => {
    if (b.allocation) {
      return b.allocation.isPaid;
    }
    return b.instance.status === 'paid';
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
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
            <p className="text-lg font-bold text-warning">
              ${new Decimal(summary.pendingAmount).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.pendingCount + summary.overdueCount} bills
            </p>
          </div>
          <div className="bg-elevated rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-lg font-bold text-error">
              {summary.overdueCount}
            </p>
            <p className="text-xs text-muted-foreground">bills</p>
          </div>
          <div className="bg-elevated rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-income">
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
                        key={`${item.instance.id}-${item.allocation?.id || 'full'}`}
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
                    <CheckCircle2 className="w-4 h-4 text-income" />
                    Paid This Period ({paidBills.length})
                  </h3>
                  <div className="space-y-2 opacity-75">
                    {paidBills.map((item) => (
                      <div
                        key={`${item.instance.id}-${item.allocation?.id || 'full'}`}
                        className="flex items-center justify-between p-3 bg-elevated rounded-lg border border-income/20"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-income" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{item.bill.name}</p>
                              {item.isSplit && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1">
                                  <Split className="w-3 h-3" />
                                  P{item.allocation?.periodNumber}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Paid ${new Decimal(item.displayPaidAmount || item.instance.actualAmount || item.instance.expectedAmount).toFixed(2)}
                              {item.isSplit && ` of $${new Decimal(item.instance.expectedAmount).toFixed(2)}`}
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
                  <CheckCircle2 className="w-12 h-12 text-income mx-auto mb-3" />
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
  onPay: (instanceId: string, accountId: string, amount: number, allocationId?: string) => void;
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
  const isPartiallyPaid = item.instance.paymentStatus === 'partial' || 
    (item.allocation && (item.allocation.paidAmount || 0) > 0 && !item.allocation.isPaid);
  const dueDate = parseISO(item.instance.dueDate);
  
  // Use display amounts if available (for split bills)
  const displayAmount = item.displayAmount ?? item.instance.expectedAmount;
  const displayRemaining = item.displayRemainingAmount ?? 
    (item.instance.remainingAmount ?? item.instance.expectedAmount);

  return (
    <div
      className={`rounded-lg border transition-all ${
        isPayFormOpen
          ? 'bg-card border-primary'
          : isOverdue
          ? 'bg-elevated border-error/30'
          : 'bg-elevated border-border'
      }`}
    >
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="mt-0.5">
            {isOverdue ? (
              <AlertCircle className="w-5 h-5 text-error" />
            ) : isIncome ? (
              <ArrowDownCircle className="w-5 h-5 text-income/50" />
            ) : isPartiallyPaid ? (
              <Clock className="w-5 h-5 text-primary" />
            ) : (
              <Clock className="w-5 h-5 text-warning" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground truncate">{item.bill.name}</p>
              {item.isSplit && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1">
                  <Split className="w-3 h-3" />
                  P{item.allocation?.periodNumber}
                </span>
              )}
              {item.periodAssignment.isOverride && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
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
              {item.isSplit && ` (of $${new Decimal(item.instance.expectedAmount).toFixed(2)} total)`}
            </p>
            {isPartiallyPaid && (
              <div className="mt-1">
                <div className="h-1.5 bg-background rounded-full overflow-hidden w-24">
                  <div 
                    className="h-full bg-success transition-all duration-300"
                    style={{ 
                      width: `${((item.allocation?.paidAmount || item.instance.paidAmount || 0) / displayAmount) * 100}%` 
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className={`font-medium ${isIncome ? 'text-income' : 'text-foreground'}`}>
              {isIncome ? '+' : ''}${new Decimal(displayAmount).toFixed(2)}
            </p>
            {isPartiallyPaid && (
              <p className="text-[10px] text-muted-foreground">
                ${new Decimal(displayRemaining).toFixed(2)} left
              </p>
            )}
          </div>
          {!isPayFormOpen && (
            <Button
              size="sm"
              onClick={onOpenPayForm}
              disabled={processing}
              className="bg-primary hover:bg-primary/90 text-white"
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
            bill={{
              ...item.bill,
              accountId: item.bill.accountId ?? undefined,
            }}
            accounts={accounts}
            defaultAccountId={item.bill.accountId || item.account?.id}
            onPay={(accountId, amount, allocationId) => onPay(item.instance.id, accountId, amount, allocationId)}
            onMarkPaid={() => onMarkPaid(item.instance.id)}
            onCancel={onClosePayForm}
            processing={processing}
            allocation={item.allocation}
            allAllocations={item.allAllocations || []}
            displayAmount={displayAmount}
            displayRemainingAmount={displayRemaining}
          />
        </div>
      )}
    </div>
  );
}
