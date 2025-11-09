'use client';

import { useEffect, useState } from 'react';
import { format, parseISO, differenceInDays, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { AlertCircle, CheckCircle2, Clock, DollarSign, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';

interface BillInstance {
  id: string;
  userId: string;
  billId: string;
  dueDate: string;
  expectedAmount: number;
  actualAmount?: number;
  paidDate?: string;
  transactionId?: string;
  status: 'pending' | 'paid' | 'overdue' | 'skipped';
  daysLate: number;
  lateFee: number;
  isManualOverride: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Bill {
  id: string;
  userId: string;
  name: string;
  categoryId?: string;
  expectedAmount: number;
  dueDate: number;
  isVariableAmount: boolean;
  amountTolerance: number;
  payeePatterns?: string;
  accountId?: string;
  isActive: boolean;
  autoMarkPaid: boolean;
  notes?: string;
  createdAt: string;
}

interface BillWithInstance extends Bill {
  upcomingInstances?: BillInstance[];
}

export default function BillsDashboard() {
  const [bills, setBills] = useState<BillWithInstance[]>([]);
  const [billInstances, setBillInstances] = useState<BillInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUpcoming: 0,
    totalOverdue: 0,
    totalUpcomingAmount: 0,
    totalOverdueAmount: 0,
    paidThisMonth: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch active bills
        const billsRes = await fetch('/api/bills?isActive=true&limit=100');
        if (!billsRes.ok) {
          throw new Error(`Failed to fetch bills: ${billsRes.statusText}`);
        }
        const billsData = await billsRes.json();

        // Fetch all bill instances
        const instancesRes = await fetch('/api/bills/instances?limit=1000');
        if (!instancesRes.ok) {
          throw new Error(`Failed to fetch bill instances: ${instancesRes.statusText}`);
        }
        const instancesData = await instancesRes.json();

        // Handle empty data safely
        // Extract bill objects from nested structure { bill, category, account }
        const billsList = Array.isArray(billsData?.data)
          ? billsData.data.map((row: any) => row.bill)
          : [];

        // Extract instance objects from nested structure { instance, bill }
        const rawInstances = Array.isArray(instancesData?.data) ? instancesData.data : [];
        const instancesList = rawInstances.map((row: any) => ({
          ...row.instance,
          bill: row.bill,
        }));

        setBills(billsList);
        setBillInstances(instancesList);

        // Calculate statistics
        calculateStats(instancesList);
      } catch (error) {
        console.error('Error fetching bills:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to load bills');
        // Set empty state on error
        setBills([]);
        setBillInstances([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculateStats = (instances: BillInstance[]) => {
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    let totalUpcoming = 0;
    let totalOverdue = 0;
    let totalUpcomingAmount = 0;
    let totalOverdueAmount = 0;
    let paidThisMonth = 0;

    instances.forEach((instance) => {
      const dueDate = parseISO(instance.dueDate);
      const isPaid = instance.status === 'paid';
      const isOverdue = instance.status === 'overdue';
      const isPending = instance.status === 'pending';

      if (isOverdue) {
        totalOverdue++;
        totalOverdueAmount += instance.expectedAmount;
      }

      if (isPending && dueDate <= thirtyDaysFromNow && dueDate >= today) {
        totalUpcoming++;
        totalUpcomingAmount += instance.expectedAmount;
      }

      if (
        isPaid &&
        dueDate >= monthStart &&
        dueDate <= monthEnd
      ) {
        paidThisMonth++;
      }
    });

    setStats({
      totalUpcoming,
      totalOverdue,
      totalUpcomingAmount,
      totalOverdueAmount,
      paidThisMonth,
    });
  };

  const getUpcomingBills = () => {
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);

    return billInstances
      .filter((instance) => {
        const dueDate = parseISO(instance.dueDate);
        return (
          instance.status === 'pending' &&
          dueDate >= today &&
          dueDate <= thirtyDaysFromNow
        );
      })
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
  };

  const getOverdueBills = () => {
    return billInstances
      .filter((instance) => instance.status === 'overdue')
      .sort((a, b) => parseISO(b.dueDate).getTime() - parseISO(a.dueDate).getTime());
  };

  const getPaidThisMonth = () => {
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    return billInstances
      .filter((instance) => {
        const dueDate = parseISO(instance.dueDate);
        return (
          instance.status === 'paid' &&
          dueDate >= monthStart &&
          dueDate <= monthEnd
        );
      })
      .sort((a, b) => parseISO(b.dueDate).getTime() - parseISO(a.dueDate).getTime());
  };

  const getBillName = (billId: string) => {
    const bill = bills.find((b) => b.id === billId);
    return bill?.name || 'Unknown Bill';
  };

  const BillItem = ({ instance, showDaysUntil = true }: { instance: BillInstance; showDaysUntil?: boolean }) => {
    const dueDate = parseISO(instance.dueDate);
    const today = new Date();
    const daysUntil = differenceInDays(dueDate, today);
    const billName = getBillName(instance.billId);

    return (
      <Link href={`/dashboard/bills/${instance.billId}`}>
        <div className="flex items-center justify-between p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:bg-[#242424] transition-colors cursor-pointer">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-0.5">
              {instance.status === 'paid' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {instance.status === 'overdue' && <AlertCircle className="w-5 h-5 text-red-400" />}
              {instance.status === 'pending' && <Clock className="w-5 h-5 text-amber-400" />}
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">{billName}</p>
              <p className="text-sm text-gray-500">
                Due: {format(dueDate, 'MMM d, yyyy')}
              </p>
              {instance.status === 'overdue' && instance.daysLate > 0 && (
                <p className="text-sm text-red-400">
                  {instance.daysLate} day{instance.daysLate !== 1 ? 's' : ''} overdue
                  {instance.lateFee > 0 && ` • Late fee: $${instance.lateFee.toFixed(2)}`}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium text-white">${instance.expectedAmount.toFixed(2)}</p>
            {showDaysUntil && instance.status === 'pending' && (
              <p className={`text-sm ${daysUntil <= 3 ? 'text-amber-400' : 'text-gray-500'}`}>
                {daysUntil === 0 && 'Due today'}
                {daysUntil === 1 && 'Due tomorrow'}
                {daysUntil > 1 && `${daysUntil} days left`}
              </p>
            )}
            {instance.status === 'paid' && (
              <p className="text-sm text-emerald-400">Paid</p>
            )}
          </div>
        </div>
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="w-full p-6 space-y-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[#1a1a1a] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const upcomingBills = getUpcomingBills();
  const overdueBills = getOverdueBills();
  const paidBills = getPaidThisMonth();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Bills</h1>
          <p className="text-gray-400 mt-2">Track your upcoming and overdue bills</p>
        </div>
        <Link href="/dashboard/bills/new">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            New Bill
          </Button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Upcoming (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-400">{stats.totalUpcoming}</div>
            <p className="text-xs text-gray-500 mt-1">
              ${stats.totalUpcomingAmount.toFixed(2)} total
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400">{stats.totalOverdue}</div>
            <p className="text-xs text-gray-500 mt-1">
              ${stats.totalOverdueAmount.toFixed(2)} total
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Paid this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-400">{stats.paidThisMonth}</div>
            <p className="text-xs text-gray-500 mt-1">
              Keep up the great work!
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400">
              {bills.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Active bills
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Bills Section */}
      {overdueBills.length > 0 && (
        <Card className="bg-[#0a0a0a] border-red-900/30">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Overdue Bills
            </CardTitle>
            <CardDescription className="text-gray-500">
              {overdueBills.length} bill{overdueBills.length !== 1 ? 's' : ''} need immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueBills.map((instance) => (
              <BillItem key={instance.id} instance={instance} showDaysUntil={false} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Bills Section */}
      <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Upcoming Bills (Next 30 Days)
          </CardTitle>
          <CardDescription className="text-gray-500">
            {upcomingBills.length > 0
              ? `${upcomingBills.length} bill${upcomingBills.length !== 1 ? 's' : ''} coming up`
              : 'No upcoming bills in the next 30 days'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcomingBills.length > 0 ? (
            upcomingBills.map((instance) => (
              <BillItem key={instance.id} instance={instance} />
            ))
          ) : (
            <p className="text-center text-gray-500 py-8">
              Great! No bills due in the next 30 days.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Paid This Month Section */}
      {paidBills.length > 0 && (
        <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Paid This Month
            </CardTitle>
            <CardDescription className="text-gray-500">
              {paidBills.length} bill{paidBills.length !== 1 ? 's' : ''} paid
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {paidBills.map((instance) => (
              <BillItem key={instance.id} instance={instance} showDaysUntil={false} />
            ))}
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
