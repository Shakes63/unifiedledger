'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, AlertCircle, ArrowRight, Calendar as CalendarIcon, Wallet } from 'lucide-react';
import Link from 'next/link';
import Decimal from 'decimal.js';
import { parseISO, format } from 'date-fns';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { BillPayModal } from '@/components/bills/bill-pay-modal';

interface BillInstance {
  id: string;
  billId: string;
  dueDate: string;
  expectedAmount: number;
  actualAmount?: number;
  status: 'pending' | 'paid' | 'overdue' | 'skipped';
  bill?: {
    id: string;
    name: string;
  };
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
        `/api/bills/instances?status=overdue&limit=10000`
      );
      
      // Fetch pending and paid bills for current month
      const currentMonthResponse = await fetchWithHousehold(
        `/api/bills/instances?status=pending,paid&limit=1000`
      );

      const allBillInstances: BillInstance[] = [];

      interface BillInstanceRow {
        instance: BillInstance;
        bill: { id: string; name: string };
      }

      // Process overdue bills - include all regardless of date
      if (overdueResponse.ok) {
        const overdueData = await overdueResponse.json();
        const overdueRawData = Array.isArray(overdueData) ? overdueData : overdueData.data || [];
        const overdueBills = overdueRawData.map((row: BillInstanceRow) => ({
          ...row.instance,
          bill: row.bill,
        }));
        allBillInstances.push(...overdueBills);
      }

      // Process pending and paid bills
      if (currentMonthResponse.ok) {
        const currentMonthData = await currentMonthResponse.json();
        const currentMonthRawData = Array.isArray(currentMonthData) ? currentMonthData : currentMonthData.data || [];
        const currentMonthBills = currentMonthRawData.map((row: BillInstanceRow) => ({
          ...row.instance,
          bill: row.bill,
        }));

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-success)' }} />;
      case 'overdue':
        return <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-error)' }} />;
      default:
        return <Clock className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-success/20 text-success';
      case 'overdue':
        return 'bg-error/20 text-error';
      default:
        return 'bg-warning/20 text-warning';
    }
  };

  if (loading) {
    return (
      <Card className="p-6 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 rounded w-1/3" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
          <div className="h-4 rounded w-full" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          <h3 className="text-lg font-semibold text-foreground">This Month&apos;s Bills</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setBillPayModalOpen(true)}
            className="bg-income hover:opacity-90 text-white"
          >
            <Wallet className="w-4 h-4 mr-1" />
            Pay Bills
          </Button>
          <Link href="/dashboard/bills">
            <Button
              variant="ghost"
              size="sm"
              className="hover:bg-elevated text-primary"
            >
              View All <ArrowRight className="w-4 h-4 ml-1" />
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
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-foreground font-medium">
                {paidCount} of {totalCount} bills paid
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
                {progressPercentage.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${progressPercentage}%`,
                  backgroundColor: 'var(--color-success)',
                }}
              />
            </div>
          </div>

          {/* Amount Summary */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
              <p className="text-muted-foreground text-xs mb-1">Total</p>
              <p className="text-base font-bold text-foreground">${totalAmount.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
              <p className="text-muted-foreground text-xs mb-1">Paid</p>
              <p className="text-base font-bold" style={{ color: 'var(--color-success)' }}>
                ${paidAmount.toFixed(2)}
              </p>
            </div>
            <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
              <p className="text-muted-foreground text-xs mb-1">Remaining</p>
              <p className="text-base font-bold" style={{ color: overdueCount > 0 ? 'var(--color-error)' : 'var(--color-warning)' }}>
                ${remainingAmount.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Sort Toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {overdueCount > 0 && (
                <span className="px-2 py-1 rounded-md bg-error/20 text-error font-medium">
                  {overdueCount} Overdue
                </span>
              )}
              {pendingCount > 0 && (
                <span className="text-muted-foreground">
                  {pendingCount} Pending
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className={`text-xs h-7 ${sortBy === 'date' ? 'bg-elevated' : ''}`}
                onClick={() => setSortBy('date')}
              >
                By Date
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`text-xs h-7 ${sortBy === 'amount' ? 'bg-elevated' : ''}`}
                onClick={() => setSortBy('amount')}
              >
                By Amount
              </Button>
            </div>
          </div>

          {/* Bills List */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {bills.map((bill) => {
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
                  className="flex items-center justify-between p-4 rounded-lg border transition-all hover:bg-elevated"
                  style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getStatusIcon(bill.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{bill.bill?.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Due {formattedDate}</span>
                        {bill.status === 'pending' && daysUntilDue >= 0 && (
                          <span className="text-muted-foreground">
                            ({daysUntilDue === 0 ? 'Today' : daysUntilDue === 1 ? 'Tomorrow' : `${daysUntilDue} days`})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="text-sm font-bold text-foreground">
                      ${(bill.actualAmount || bill.expectedAmount).toFixed(2)}
                    </p>
                    <span
                      className={`px-3 py-1 rounded-md text-xs font-medium ${getStatusColor(
                        bill.status
                      )}`}
                    >
                      {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--color-success)', opacity: 0.5 }} />
          <p className="text-lg font-medium text-foreground mb-2">No bills this month</p>
          <p className="text-sm text-muted-foreground mb-4">
            You&apos;re all set! No bills are due this month.
          </p>
          <Link href="/dashboard/bills/new">
            <Button size="sm" className="bg-primary text-primary-foreground">
              Add a Bill
            </Button>
          </Link>
        </div>
      )}
    </Card>
  );
}
