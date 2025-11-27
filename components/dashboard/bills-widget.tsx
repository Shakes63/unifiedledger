'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

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

export function BillsWidget() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [bills, setBills] = useState<BillInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    const fetchBills = async () => {
      try {
        setLoading(true);
        // Get current month start and end
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const response = await fetchWithHousehold(`/api/bills/instances?status=pending,paid&sortBy=dueDate`);

        if (response.ok) {
          const response_data = await response.json();
          const rawData = Array.isArray(response_data) ? response_data : response_data.data || [];

          // Transform the data structure from { instance, bill } to flat structure with nested bill
          const billInstances = rawData.map((row: any) => ({
            ...row.instance,
            bill: row.bill,
          }));

          // Filter for this month only
          const thisMonthBills = billInstances.filter((bill: BillInstance) => {
            const dueDate = new Date(bill.dueDate);
            return dueDate >= startOfMonth && dueDate <= endOfMonth;
          });
          setBills(thisMonthBills.slice(0, 5)); // Show top 5
        } else {
          console.error('Failed to load bills');
        }
      } catch (error) {
        console.error('Error fetching bills:', error);
        if (error instanceof Error && error.message === 'No household selected') {
          setLoading(false);
          return;
        }
      } finally {
        setLoading(false);
      }
    };

    fetchBills();
  }, [selectedHouseholdId, fetchWithHousehold]);

  // Listen for bill refresh events (when transactions are created/updated)
  useEffect(() => {
    if (!selectedHouseholdId) return;
    
    const fetchBillsForRefresh = async () => {
      try {
        setLoading(true);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const response = await fetchWithHousehold(`/api/bills/instances?status=pending,paid&sortBy=dueDate`);

        if (response.ok) {
          const response_data = await response.json();
          const rawData = Array.isArray(response_data) ? response_data : response_data.data || [];

          const billInstances = rawData.map((row: any) => ({
            ...row.instance,
            bill: row.bill,
          }));

          const thisMonthBills = billInstances.filter((bill: BillInstance) => {
            const dueDate = new Date(bill.dueDate);
            return dueDate >= startOfMonth && dueDate <= endOfMonth;
          });
          setBills(thisMonthBills.slice(0, 5));
        }
      } catch (error) {
        console.error('Error refreshing bills:', error);
      } finally {
        setLoading(false);
      }
    };
    
    const handleBillsRefresh = () => {
      if (selectedHouseholdId) {
        fetchBillsForRefresh();
      }
    };

    window.addEventListener('bills-refresh', handleBillsRefresh);
    return () => window.removeEventListener('bills-refresh', handleBillsRefresh);
  }, [selectedHouseholdId, fetchWithHousehold]);

  const _paidCount = bills.filter((b) => b.status === 'paid').length;
  const pendingCount = bills.filter((b) => b.status === 'pending').length;
  const totalAmount = bills.reduce((sum, b) => sum + (b.actualAmount || b.expectedAmount), 0);
  const paidAmount = bills
    .filter((b) => b.status === 'paid')
    .reduce((sum, b) => sum + (b.actualAmount || b.expectedAmount), 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'overdue':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-amber-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-500/10 text-emerald-400';
      case 'overdue':
        return 'bg-red-500/10 text-red-400';
      default:
        return 'bg-amber-500/10 text-amber-400';
    }
  };

  if (loading) {
    return (
      <Card className="p-6 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 rounded w-1/3" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 rounded" style={{ backgroundColor: 'var(--color-elevated)' }}></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">This Month's Bills</h3>
        <Link href="/dashboard/bills">
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-elevated"
            style={{ color: 'var(--color-income)' }}
          >
            View All <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>

      {bills.length > 0 ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
              <p className="text-muted-foreground text-xs mb-1">Total</p>
              <p className="text-lg font-semibold text-foreground">${totalAmount.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
              <p className="text-muted-foreground text-xs mb-1">Paid</p>
              <p className="text-lg font-semibold" style={{ color: 'var(--color-income)' }}>${paidAmount.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
              <p className="text-muted-foreground text-xs mb-1">Pending</p>
              <p className="text-lg font-semibold" style={{ color: 'var(--color-warning)' }}>{pendingCount}</p>
            </div>
          </div>

          {/* Bills List */}
          <div className="space-y-2">
            {bills.map((bill) => {
              const dueDate = new Date(bill.dueDate);
              const formattedDate = dueDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-3 rounded-lg border transition-all"
                  style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(bill.status)}
                    <div>
                      <p className="text-sm font-medium text-foreground">{bill.bill?.name}</p>
                      <p className="text-xs text-muted-foreground">Due {formattedDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      ${(bill.actualAmount || bill.expectedAmount).toFixed(2)}
                    </p>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
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
        <div className="text-center py-8">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-income)', opacity: 0.5 }} />
          <p className="text-muted-foreground">No bills this month</p>
        </div>
      )}
    </Card>
  );
}
