'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

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
  const [bills, setBills] = useState<BillInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBills = async () => {
      try {
        setLoading(true);
        // Get current month start and end
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const response = await fetch(
          `/api/bills/instances?status=pending,paid&sortBy=dueDate`
        );

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
      } finally {
        setLoading(false);
      }
    };

    fetchBills();
  }, []);

  const paidCount = bills.filter((b) => b.status === 'paid').length;
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
      <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[#242424] rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-[#242424] rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">This Month's Bills</h3>
        <Link href="/dashboard/bills">
          <Button
            variant="ghost"
            size="sm"
            className="text-emerald-400 hover:bg-emerald-400/10"
          >
            View All <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>

      {bills.length > 0 ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 bg-[#242424] rounded-lg border border-[#2a2a2a]">
              <p className="text-gray-500 text-xs mb-1">Total</p>
              <p className="text-lg font-semibold text-white">${totalAmount.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-[#242424] rounded-lg border border-[#2a2a2a]">
              <p className="text-gray-500 text-xs mb-1">Paid</p>
              <p className="text-lg font-semibold text-emerald-400">${paidAmount.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-[#242424] rounded-lg border border-[#2a2a2a]">
              <p className="text-gray-500 text-xs mb-1">Pending</p>
              <p className="text-lg font-semibold text-amber-400">{pendingCount}</p>
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
                  className="flex items-center justify-between p-3 bg-[#242424] rounded-lg border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(bill.status)}
                    <div>
                      <p className="text-sm font-medium text-white">{bill.bill?.name}</p>
                      <p className="text-xs text-gray-500">Due {formattedDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">
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
          <CheckCircle2 className="w-12 h-12 text-emerald-400/50 mx-auto mb-3" />
          <p className="text-gray-500">No bills this month</p>
        </div>
      )}
    </Card>
  );
}
