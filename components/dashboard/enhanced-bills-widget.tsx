'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Calendar as CalendarIcon, Wallet } from 'lucide-react';
import Link from 'next/link';
import Decimal from 'decimal.js';
import { parseISO, format } from 'date-fns';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { BillPayModal } from '@/components/bills/bill-pay-modal';
import type { BillOccurrenceWithTemplateDto } from '@/lib/bills/contracts';

interface BillInstance {
  id: string;
  billId: string;
  dueDate: string;
  expectedAmount: number;
  actualAmount?: number | null;
  status: 'pending' | 'paid' | 'overdue' | 'skipped';
  bill?: {
    id: string;
    name: string;
  };
}

function mapRows(rows: BillOccurrenceWithTemplateDto[]): BillInstance[] {
  return rows.map((row) => ({
    id: row.occurrence.id,
    billId: row.occurrence.templateId,
    dueDate: row.occurrence.dueDate,
    expectedAmount: row.occurrence.amountDueCents / 100,
    actualAmount:
      row.occurrence.actualAmountCents !== null ? row.occurrence.actualAmountCents / 100 : null,
    status:
      row.occurrence.status === 'paid' || row.occurrence.status === 'overpaid'
        ? 'paid'
        : row.occurrence.status === 'overdue'
          ? 'overdue'
          : row.occurrence.status === 'skipped'
            ? 'skipped'
            : 'pending',
    bill: { id: row.template.id, name: row.template.name },
  }));
}

type SortOption = 'date' | 'amount';

export function EnhancedBillsWidget() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [bills, setBills] = useState<BillInstance[]>([]);
  const [allBills, setAllBills] = useState<BillInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [billPayModalOpen, setBillPayModalOpen] = useState(false);

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Fetch overdue bills separately with high limit to ensure we get all of them
      const overdueResponse = await fetchWithHousehold(
        '/api/bills/occurrences?status=overdue&limit=10000'
      );
      
      // Fetch pending and paid bills for current month
      const currentMonthResponse = await fetchWithHousehold(
        '/api/bills/occurrences?status=unpaid,partial,paid&limit=1000'
      );

      const allBillInstances: BillInstance[] = [];

      // Process overdue bills - include all regardless of date
      if (overdueResponse.ok) {
        const overdueData = await overdueResponse.json();
        const overdueRawData = (Array.isArray(overdueData?.data)
          ? overdueData.data
          : []) as BillOccurrenceWithTemplateDto[];
        const overdueBills = mapRows(overdueRawData);
        allBillInstances.push(...overdueBills);
      }

      // Process pending and paid bills
      if (currentMonthResponse.ok) {
        const currentMonthData = await currentMonthResponse.json();
        const currentMonthRawData = (Array.isArray(currentMonthData?.data)
          ? currentMonthData.data
          : []) as BillOccurrenceWithTemplateDto[];
        const currentMonthBills = mapRows(currentMonthRawData);

        // Filter pending and paid bills by current month
        const filteredCurrentMonthBills = currentMonthBills.filter((bill: BillInstance) => {
          const dueDate = parseISO(bill.dueDate);
          return dueDate >= startOfMonth && dueDate <= endOfMonth;
        });
        
        allBillInstances.push(...filteredCurrentMonthBills);
      }

      // Remove duplicates (in case a bill appears in both responses)
      const uniqueBills = allBillInstances.filter((bill, index, self) =>
        index === self.findIndex((b) => b.id === bill.id)
      );

      const sorted = sortBills(uniqueBills, sortBy);
      setAllBills(sorted);
      setBills(sorted); // Show all bills
    } catch (error) {
      console.error('Error fetching bills:', error);
      if (error instanceof Error && error.message === 'No household selected') {
        setLoading(false);
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithHousehold, sortBy]);

  useEffect(() => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }
    fetchBills();
  }, [selectedHouseholdId, fetchBills]);

  // Listen for bill refresh events (when transactions are created/updated)
  useEffect(() => {
    const handleBillsRefresh = () => {
      if (selectedHouseholdId) {
        fetchBills();
      }
    };

    window.addEventListener('bills-refresh', handleBillsRefresh);
    return () => window.removeEventListener('bills-refresh', handleBillsRefresh);
  }, [selectedHouseholdId, fetchBills]);

  useEffect(() => {
    // Re-sort when sortBy changes
    if (allBills.length > 0) {
      const sorted = sortBills([...allBills], sortBy);
      setBills(sorted);
    }
  }, [sortBy, allBills]);

  const sortBills = (billsToSort: BillInstance[], option: SortOption): BillInstance[] => {
    // Group bills by status with priority: overdue > pending > paid
    const overdueBills = billsToSort.filter(b => b.status === 'overdue');
    const pendingBills = billsToSort.filter(b => b.status === 'pending');
    const paidBills = billsToSort.filter(b => b.status === 'paid');
    
    // Sort each group by date (oldest first) or amount
    const sortGroup = (group: BillInstance[]) => {
      return [...group].sort((a, b) => {
        if (option === 'date') {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        } else {
          // Sort by amount (descending)
          const amountA = a.actualAmount || a.expectedAmount;
          const amountB = b.actualAmount || b.expectedAmount;
          return amountB - amountA;
        }
      });
    };
    
    // Combine groups in order: overdue → pending → paid
    return [
      ...sortGroup(overdueBills),
      ...sortGroup(pendingBills),
      ...sortGroup(paidBills)
    ];
  };

  const paidCount = allBills.filter((b) => b.status === 'paid').length;
  const pendingCount = allBills.filter((b) => b.status === 'pending').length;
  const overdueCount = allBills.filter((b) => b.status === 'overdue').length;
  const totalCount = allBills.length;

  const totalAmount = allBills.reduce((sum, b) => {
    return new Decimal(sum).plus(new Decimal(b.actualAmount || b.expectedAmount)).toNumber();
  }, 0);

  const paidAmount = allBills
    .filter((b) => b.status === 'paid')
    .reduce((sum, b) => {
      return new Decimal(sum).plus(new Decimal(b.actualAmount || b.expectedAmount)).toNumber();
    }, 0);

  const remainingAmount = new Decimal(totalAmount).minus(paidAmount).toNumber();
  const progressPercentage = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

  const getStatusAccentColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'var(--color-success)';
      case 'overdue':
        return 'var(--color-destructive)';
      default:
        return 'var(--color-warning)';
    }
  };

  if (loading) {
    return (
      <div
        className="relative overflow-hidden rounded-xl border p-4"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-background)',
          borderLeftWidth: 4,
          borderLeftColor: 'var(--color-primary)',
        }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)' }} />
        <div className="animate-pulse space-y-4 relative">
          <div className="h-4 rounded w-1/3" style={{ backgroundColor: 'var(--color-elevated)' }} />
          <div className="h-1.5 rounded-full w-full" style={{ backgroundColor: 'var(--color-elevated)' }} />
          <div className="flex">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 flex flex-col gap-1 py-1">
                <div className="h-3 rounded w-2/3" style={{ backgroundColor: 'var(--color-elevated)' }} />
                <div className="h-4 rounded w-1/2" style={{ backgroundColor: 'var(--color-elevated)' }} />
              </div>
            ))}
          </div>
          <div className="space-y-0">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 border-b flex items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
                <div className="w-1 h-8 rounded" style={{ backgroundColor: 'var(--color-elevated)' }} />
                <div className="flex-1">
                  <div className="h-3 rounded w-1/3 mb-2" style={{ backgroundColor: 'var(--color-elevated)' }} />
                  <div className="h-3 rounded w-1/4" style={{ backgroundColor: 'var(--color-elevated)' }} />
                </div>
                <div className="h-4 rounded w-16" style={{ backgroundColor: 'var(--color-elevated)' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-background)',
        borderLeftWidth: 4,
        borderLeftColor: 'var(--color-primary)',
      }}
    >
      {/* Subtle radial gradient overlay top-right */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)' }} />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          <h3 className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>This Month&apos;s Bills</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setBillPayModalOpen(true)}
            className="hover:opacity-90 h-8 text-xs transition-all duration-150"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
          >
            <Wallet className="w-3.5 h-3.5 mr-1" />
            Pay Bills
          </Button>
          <Link href="/dashboard/bills">
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-[var(--color-elevated)] h-8 text-xs transition-all duration-150"
              style={{ color: 'var(--color-primary)' }}
            >
              View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Bill Pay Modal */}
      <BillPayModal
        open={billPayModalOpen}
        onOpenChange={setBillPayModalOpen}
        onBillPaid={fetchBills}
      />

      {bills.length > 0 ? (
        <>
          {/* Progress Bar */}
          <div className="mb-4 relative">
            <div className="flex items-center justify-end gap-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-elevated)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progressPercentage}%`,
                    backgroundColor: 'var(--color-success)',
                  }}
                />
              </div>
              <span className="text-xs font-semibold tabular-nums w-8 text-right" style={{ color: 'var(--color-success)' }}>
                {progressPercentage.toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Summary stats - horizontal row with dividers */}
          <div className="flex items-stretch mb-4 relative">
            <div className="flex-1 flex flex-col justify-center py-1">
              <p className="text-[10px] uppercase tracking-[0.08em] mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Total</p>
              <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}>${totalAmount.toFixed(2)}</p>
            </div>
            <div className="w-px shrink-0" style={{ backgroundColor: 'var(--color-border)' }} />
            <div className="flex-1 flex flex-col justify-center py-1">
              <p className="text-[10px] uppercase tracking-[0.08em] mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Paid</p>
              <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>${paidAmount.toFixed(2)}</p>
            </div>
            <div className="w-px shrink-0" style={{ backgroundColor: 'var(--color-border)' }} />
            <div className="flex-1 flex flex-col justify-center py-1">
              <p className="text-[10px] uppercase tracking-[0.08em] mb-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Remaining</p>
              <p className="text-sm font-bold tabular-nums" style={{ color: overdueCount > 0 ? 'var(--color-destructive)' : 'var(--color-warning)', fontVariantNumeric: 'tabular-nums' }}>${remainingAmount.toFixed(2)}</p>
            </div>
          </div>

          {/* Sort Toggle + Overdue/Pending count */}
          <div className="flex items-center justify-between mb-3 relative">
            <div className="flex items-center gap-2 text-xs">
              {overdueCount > 0 && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 10%, transparent)', color: 'var(--color-destructive)' }}>
                  {overdueCount} Overdue
                </span>
              )}
              {pendingCount > 0 && (
                <span style={{ color: 'var(--color-muted-foreground)' }}>{pendingCount} Pending</span>
              )}
            </div>
            <div className="flex gap-1 rounded-full p-0.5" style={{ backgroundColor: 'var(--color-elevated)' }}>
              <button
                type="button"
                className="rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150"
                style={sortBy === 'date' ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' } : { color: 'var(--color-muted-foreground)' }}
                onClick={() => setSortBy('date')}
              >
                By Date
              </button>
              <button
                type="button"
                className="rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150"
                style={sortBy === 'amount' ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' } : { color: 'var(--color-muted-foreground)' }}
                onClick={() => setSortBy('amount')}
              >
                By Amount
              </button>
            </div>
          </div>

          {/* Bills List */}
          <div className="max-h-[400px] overflow-y-auto relative">
            {bills.map((bill, i) => {
              const dueDate = parseISO(bill.dueDate);
              const formattedDate = format(dueDate, 'MMM d');

              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dueDateOnly = new Date(dueDate);
              dueDateOnly.setHours(0, 0, 0, 0);
              const daysUntilDue = Math.ceil((dueDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={bill.id}
                  className="flex items-center justify-between py-2 px-3 border-l-[3px] border-b last:border-b-0 transition-all duration-150 hover:opacity-90 dashboard-fade-in"
                  style={{
                    borderLeftColor: getStatusAccentColor(bill.status),
                    borderBottomColor: 'var(--color-border)',
                    animationDelay: `${i * 30}ms`,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-foreground)' }}>{bill.bill?.name}</p>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                      <span>Due {formattedDate}</span>
                      {bill.status === 'pending' && daysUntilDue >= 0 && (
                        <span>
                          ({daysUntilDue === 0 ? 'Today' : daysUntilDue === 1 ? 'Tomorrow' : `${daysUntilDue} days`})
                        </span>
                      )}
                    </div>
                  </div>
                  <p
                    className="text-sm font-bold shrink-0 ml-2"
                    style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    ${(bill.actualAmount || bill.expectedAmount).toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-12 relative">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--color-success)', opacity: 0.5 }} />
          <p className="text-lg font-medium mb-2" style={{ color: 'var(--color-foreground)' }}>No bills this month</p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-muted-foreground)' }}>
            You&apos;re all set! No bills are due this month.
          </p>
          <Link href="/dashboard/bills/new">
            <Button size="sm" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              Add a Bill
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
