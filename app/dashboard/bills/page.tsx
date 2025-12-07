'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, parseISO, differenceInDays, addDays, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns';
import { AlertCircle, CheckCircle2, Clock, DollarSign, Plus, ChevronLeft, ChevronRight, CalendarRange, ArrowDownCircle, TrendingUp, CreditCard, Zap, Home, Shield, Banknote, Users, Wrench, MoreHorizontal, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import { FREQUENCY_LABELS } from '@/lib/bills/bill-utils';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { type BillClassification, CLASSIFICATION_META } from '@/lib/bills/bill-classification';
import { BillPayModal } from '@/components/bills/bill-pay-modal';

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
  frequency: string;
  specificDueDate?: string;
  startMonth?: number | null; // 0-11 for quarterly/semi-annual/annual bills
  isVariableAmount: boolean;
  amountTolerance: number;
  payeePatterns?: string;
  accountId?: string;
  isActive: boolean;
  autoMarkPaid: boolean;
  notes?: string;
  createdAt: string;
  billType?: 'expense' | 'income' | 'savings_transfer';
  billClassification?: BillClassification;
  classificationSubcategory?: string | null;
}

type BillTypeFilter = 'all' | 'expense' | 'income';
type ClassificationFilter = 'all' | BillClassification;

// Classification filter options with icons
const CLASSIFICATION_FILTER_OPTIONS: Array<{
  value: ClassificationFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { value: 'all', label: 'All', icon: MoreHorizontal, color: '#6b7280' },
  { value: 'subscription', label: 'Subscriptions', icon: CreditCard, color: CLASSIFICATION_META.subscription.color },
  { value: 'utility', label: 'Utilities', icon: Zap, color: CLASSIFICATION_META.utility.color },
  { value: 'housing', label: 'Housing', icon: Home, color: CLASSIFICATION_META.housing.color },
  { value: 'insurance', label: 'Insurance', icon: Shield, color: CLASSIFICATION_META.insurance.color },
  { value: 'loan_payment', label: 'Loans', icon: Banknote, color: CLASSIFICATION_META.loan_payment.color },
  { value: 'membership', label: 'Memberships', icon: Users, color: CLASSIFICATION_META.membership.color },
  { value: 'service', label: 'Services', icon: Wrench, color: CLASSIFICATION_META.service.color },
  { value: 'other', label: 'Other', icon: MoreHorizontal, color: CLASSIFICATION_META.other.color },
];

interface BillWithInstance extends Bill {
  upcomingInstances?: BillInstance[];
}

export default function BillsDashboard() {
  const searchParams = useSearchParams();
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [bills, setBills] = useState<BillWithInstance[]>([]);
  const [billInstances, setBillInstances] = useState<BillInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingMonth, setPendingMonth] = useState<Date>(new Date());
  const [paidMonth, setPaidMonth] = useState<Date>(new Date());
  const [billTypeFilter, setBillTypeFilter] = useState<BillTypeFilter>('all');
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>('all');
  const classificationScrollRef = useRef<HTMLDivElement>(null);
  const [billPayModalOpen, setBillPayModalOpen] = useState(false);
  const [stats, setStats] = useState({
    totalUpcoming: 0,
    totalOverdue: 0,
    totalUpcomingAmount: 0,
    totalOverdueAmount: 0,
    paidThisMonth: 0,
    // Income-specific stats
    totalExpectedIncome: 0,
    totalLateIncome: 0,
    totalExpectedIncomeAmount: 0,
    totalLateIncomeAmount: 0,
    receivedThisMonth: 0,
    // Bill counts by type
    expenseBillCount: 0,
    incomeBillCount: 0,
    // Bill counts by classification
    classificationCounts: {} as Record<string, number>,
  });

  // Handle deep links from calendar events
  useEffect(() => {
    const billPay = searchParams.get('billPay');
    const payBill = searchParams.get('payBill');
    
    if (billPay === '1' || payBill) {
      // Open the bill pay modal when coming from calendar deep link
      setBillPayModalOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch active bills
        const billsRes = await fetchWithHousehold('/api/bills?isActive=true&limit=100');
        if (!billsRes.ok) {
          throw new Error(`Failed to fetch bills: ${billsRes.statusText}`);
        }
        const billsData = await billsRes.json();

        // Fetch all bill instances
        const instancesRes = await fetchWithHousehold('/api/bills/instances?limit=1000');
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
        calculateStats(instancesList, billsList);
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
  }, [selectedHouseholdId, fetchWithHousehold]);

  // Listen for bill refresh events (when transactions are created/updated)
  useEffect(() => {
    const handleBillsRefresh = () => {
      if (!selectedHouseholdId) return;
      
      const fetchData = async () => {
        try {
          setLoading(true);

          // Fetch active bills
          const billsRes = await fetchWithHousehold('/api/bills?isActive=true&limit=100');
          if (!billsRes.ok) {
            throw new Error(`Failed to fetch bills: ${billsRes.statusText}`);
          }
          const billsData = await billsRes.json();

          // Fetch all bill instances
          const instancesRes = await fetchWithHousehold('/api/bills/instances?limit=1000');
          if (!instancesRes.ok) {
            throw new Error(`Failed to fetch bill instances: ${instancesRes.statusText}`);
          }
          const instancesData = await instancesRes.json();

          // Handle empty data safely
          const billsList = Array.isArray(billsData?.data)
            ? billsData.data.map((row: any) => row.bill)
            : [];

          const rawInstances = Array.isArray(instancesData?.data) ? instancesData.data : [];
          const instancesList = rawInstances.map((row: any) => ({
            ...row.instance,
            bill: row.bill,
          }));

          setBills(billsList);
          setBillInstances(instancesList);
          calculateStats(instancesList, billsList);
        } catch (error) {
          console.error('Error refreshing bills:', error);
        } finally {
          setLoading(false);
        }
      };
      
      fetchData();
    };

    window.addEventListener('bills-refresh', handleBillsRefresh);
    return () => window.removeEventListener('bills-refresh', handleBillsRefresh);
  }, [selectedHouseholdId, fetchWithHousehold]);

  const calculateStats = (instances: BillInstance[], billsList: BillWithInstance[]) => {
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    // Create a map of bill IDs to their type
    const billTypeMap = new Map<string, string>();
    billsList.forEach(bill => {
      billTypeMap.set(bill.id, bill.billType || 'expense');
    });

    // Expense stats
    let totalUpcoming = 0;
    let totalOverdue = 0;
    let totalUpcomingAmount = 0;
    let totalOverdueAmount = 0;
    let paidThisMonth = 0;

    // Income stats
    let totalExpectedIncome = 0;
    let totalLateIncome = 0;
    let totalExpectedIncomeAmount = 0;
    let totalLateIncomeAmount = 0;
    let receivedThisMonth = 0;

    instances.forEach((instance) => {
      const dueDate = parseISO(instance.dueDate);
      const isPaid = instance.status === 'paid';
      const isOverdue = instance.status === 'overdue';
      const isPending = instance.status === 'pending';
      const billType = billTypeMap.get(instance.billId) || 'expense';
      const isIncome = billType === 'income';

      if (isIncome) {
        // Income statistics
        if (isOverdue) {
          totalLateIncome++;
          totalLateIncomeAmount += instance.expectedAmount;
        }

        if (isPending && dueDate <= thirtyDaysFromNow && dueDate >= today) {
          totalExpectedIncome++;
          totalExpectedIncomeAmount += instance.expectedAmount;
        }

        if (isPaid && dueDate >= monthStart && dueDate <= monthEnd) {
          receivedThisMonth++;
        }
      } else {
        // Expense statistics
        if (isOverdue) {
          totalOverdue++;
          totalOverdueAmount += instance.expectedAmount;
        }

        if (isPending && dueDate <= thirtyDaysFromNow && dueDate >= today) {
          totalUpcoming++;
          totalUpcomingAmount += instance.expectedAmount;
        }

        if (isPaid && dueDate >= monthStart && dueDate <= monthEnd) {
          paidThisMonth++;
        }
      }
    });

    // Count bills by type
    const expenseBillCount = billsList.filter(b => b.billType !== 'income').length;
    const incomeBillCount = billsList.filter(b => b.billType === 'income').length;

    // Count bills by classification
    const classificationCounts: Record<string, number> = {};
    billsList.forEach(bill => {
      const classification = bill.billClassification || 'other';
      classificationCounts[classification] = (classificationCounts[classification] || 0) + 1;
    });

    setStats({
      totalUpcoming,
      totalOverdue,
      totalUpcomingAmount,
      totalOverdueAmount,
      paidThisMonth,
      totalExpectedIncome,
      totalLateIncome,
      totalExpectedIncomeAmount,
      totalLateIncomeAmount,
      receivedThisMonth,
      expenseBillCount,
      incomeBillCount,
      classificationCounts,
    });
  };

  // Filter instances by bill type and classification
  const filterByBillType = (instance: BillInstance) => {
    const bill = bills.find(b => b.id === instance.billId);
    if (!bill) return true;

    // Filter by bill type
    if (billTypeFilter !== 'all') {
      const billType = bill.billType || 'expense';
      if (billTypeFilter === 'income' && billType !== 'income') return false;
      if (billTypeFilter === 'expense' && billType === 'income') return false;
    }

    // Filter by classification
    if (classificationFilter !== 'all') {
      const classification = bill.billClassification || 'other';
      if (classification !== classificationFilter) return false;
    }

    return true;
  };

  const getUpcomingBills = () => {
    const monthStart = startOfMonth(pendingMonth);
    const monthEnd = endOfMonth(pendingMonth);

    return billInstances
      .filter((instance) => {
        const dueDate = parseISO(instance.dueDate);
        return (
          instance.status === 'pending' &&
          dueDate >= monthStart &&
          dueDate <= monthEnd &&
          filterByBillType(instance)
        );
      })
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
  };

  const getOverdueBills = () => {
    return billInstances
      .filter((instance) => instance.status === 'overdue' && filterByBillType(instance))
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
  };

  const getPaidBills = () => {
    const monthStart = startOfMonth(paidMonth);
    const monthEnd = endOfMonth(paidMonth);

    return billInstances
      .filter((instance) => {
        const dueDate = parseISO(instance.dueDate);
        return (
          instance.status === 'paid' &&
          dueDate >= monthStart &&
          dueDate <= monthEnd &&
          filterByBillType(instance)
        );
      })
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
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
    const bill = bills.find((b) => b.id === instance.billId);
    const isIncomeBill = bill?.billType === 'income';

    return (
      <Link href={`/dashboard/bills/${instance.billId}`}>
        <div className={`flex items-center justify-between p-3 bg-card border rounded-lg hover:bg-elevated transition-colors cursor-pointer ${
          isIncomeBill ? 'border-[var(--color-income)]/30' : 'border-border'
        }`}>
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-0.5">
              {instance.status === 'paid' && (
                isIncomeBill 
                  ? <ArrowDownCircle className="w-5 h-5 text-[var(--color-income)]" />
                  : <CheckCircle2 className="w-5 h-5 text-[var(--color-income)]" />
              )}
              {instance.status === 'overdue' && (
                isIncomeBill
                  ? <ArrowDownCircle className="w-5 h-5 text-[var(--color-warning)]" />
                  : <AlertCircle className="w-5 h-5 text-[var(--color-error)]" />
              )}
              {instance.status === 'pending' && (
                isIncomeBill
                  ? <ArrowDownCircle className="w-5 h-5 text-[var(--color-income)]/50" />
                  : <Clock className="w-5 h-5 text-[var(--color-warning)]" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-foreground">{billName}</p>
                {bill && bill.frequency && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    isIncomeBill
                      ? 'bg-[var(--color-income)]/10 text-[var(--color-income)] border-[var(--color-income)]/20'
                      : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20'
                  }`}>
                    {FREQUENCY_LABELS[bill.frequency] || bill.frequency}
                  </span>
                )}
                {isIncomeBill && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-income)]/10 text-[var(--color-income)] border border-[var(--color-income)]/20">
                    Income
                  </span>
                )}
                {bill?.billClassification && bill.billClassification !== 'other' && (
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full border"
                    style={{ 
                      backgroundColor: `${CLASSIFICATION_META[bill.billClassification].color}15`,
                      color: CLASSIFICATION_META[bill.billClassification].color,
                      borderColor: `${CLASSIFICATION_META[bill.billClassification].color}30`
                    }}
                  >
                    {CLASSIFICATION_META[bill.billClassification].label}
                  </span>
                )}
                <EntityIdBadge id={instance.billId} label="Bill" />
                <EntityIdBadge id={instance.id} label="Instance" />
              </div>
              <p className="text-sm text-muted-foreground">
                {isIncomeBill ? 'Expected' : 'Due'}: {format(dueDate, 'MMM d, yyyy')}
              </p>
              {instance.status === 'overdue' && instance.daysLate > 0 && (
                <p className={`text-sm ${isIncomeBill ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'}`}>
                  {instance.daysLate} day{instance.daysLate !== 1 ? 's' : ''} {isIncomeBill ? 'late' : 'overdue'}
                  {!isIncomeBill && instance.lateFee > 0 && ` • Late fee: $${instance.lateFee.toFixed(2)}`}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className={`font-medium ${isIncomeBill ? 'text-[var(--color-income)]' : 'text-foreground'}`}>
              {isIncomeBill ? '+' : ''}${instance.expectedAmount.toFixed(2)}
            </p>
            {showDaysUntil && instance.status === 'pending' && (
              <p className={`text-sm ${daysUntil <= 3 ? (isIncomeBill ? 'text-[var(--color-income)]' : 'text-[var(--color-warning)]') : 'text-muted-foreground'}`}>
                {daysUntil === 0 && (isIncomeBill ? 'Expected today' : 'Due today')}
                {daysUntil === 1 && (isIncomeBill ? 'Expected tomorrow' : 'Due tomorrow')}
                {daysUntil > 1 && `${daysUntil} days`}
              </p>
            )}
            {instance.status === 'paid' && (
              <p className="text-sm text-[var(--color-income)]">{isIncomeBill ? 'Received' : 'Paid'}</p>
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
            <div key={i} className="h-24 bg-card rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const upcomingBills = getUpcomingBills();
  const overdueBills = getOverdueBills();
  const paidBills = getPaidBills();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Bills & Income</h1>
            <p className="text-muted-foreground mt-2">Track your recurring expenses and expected income</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setBillPayModalOpen(true)}
              className="bg-[var(--color-income)] hover:opacity-90 text-white"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Bill Pay
            </Button>
            <Link href="/dashboard/bills/annual-planning">
              <Button variant="outline" className="bg-elevated border-border text-foreground hover:bg-elevated">
                <CalendarRange className="w-4 h-4 mr-2" />
                Annual Planning
              </Button>
            </Link>
            <Link href="/dashboard/bills/new">
              <Button className="bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]">
                <Plus className="w-4 h-4 mr-2" />
                New
              </Button>
            </Link>
          </div>
        </div>

        {/* Filter Tabs - Bill Type */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBillTypeFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              billTypeFilter === 'all'
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({bills.length})
          </button>
          <button
            onClick={() => setBillTypeFilter('expense')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
              billTypeFilter === 'expense'
                ? 'bg-[var(--color-expense)] text-white'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Expenses ({stats.expenseBillCount})
          </button>
          <button
            onClick={() => setBillTypeFilter('income')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
              billTypeFilter === 'income'
                ? 'bg-[var(--color-income)] text-white'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Income ({stats.incomeBillCount})
          </button>
        </div>

        {/* Filter Tabs - Classification */}
        <div className="relative">
          <div 
            ref={classificationScrollRef}
            className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
          >
            {CLASSIFICATION_FILTER_OPTIONS.map((option) => {
              const Icon = option.icon;
              const count = option.value === 'all' 
                ? bills.length 
                : (stats.classificationCounts[option.value] || 0);
              const isActive = classificationFilter === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => setClassificationFilter(option.value)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'text-white'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-[var(--color-border)]'
                  }`}
                  style={isActive ? { backgroundColor: option.color } : undefined}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{option.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    isActive 
                      ? 'bg-white/20 text-white' 
                      : 'bg-elevated text-muted-foreground'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      {/* Statistics Cards */}
      {billTypeFilter === 'income' ? (
        // Income Statistics
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-background border-[var(--color-income)]/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-[var(--color-income)]" />
                Expected (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--color-income)]">{stats.totalExpectedIncome}</div>
              <p className="text-xs text-muted-foreground mt-1">
                +${stats.totalExpectedIncomeAmount.toFixed(2)} total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-background border-[var(--color-warning)]/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--color-warning)]" />
                Late Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--color-warning)]">{stats.totalLateIncome}</div>
              <p className="text-xs text-muted-foreground mt-1">
                +${stats.totalLateIncomeAmount.toFixed(2)} pending
              </p>
            </CardContent>
          </Card>

          <Card className="bg-background border-[var(--color-income)]/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--color-income)]" />
                Received this month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--color-income)]">{stats.receivedThisMonth}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Income received
              </p>
            </CardContent>
          </Card>

          <Card className="bg-background border-[var(--color-income)]/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--color-income)]" />
                Income sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--color-income)]">
                {stats.incomeBillCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Active income streams
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Expense Statistics (default)
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-background border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {billTypeFilter === 'all' ? 'Upcoming (30 days)' : 'Due (30 days)'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--color-warning)]">{stats.totalUpcoming}</div>
              <p className="text-xs text-muted-foreground mt-1">
                ${stats.totalUpcomingAmount.toFixed(2)} total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-background border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Overdue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--color-error)]">{stats.totalOverdue}</div>
              <p className="text-xs text-muted-foreground mt-1">
                ${stats.totalOverdueAmount.toFixed(2)} total
              </p>
            </CardContent>
          </Card>

          <Card className="bg-background border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Paid this month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--color-income)]">{stats.paidThisMonth}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Keep up the great work!
              </p>
            </CardContent>
          </Card>

          <Card className="bg-background border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                {billTypeFilter === 'all' ? 'Total bills' : 'Expense bills'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--color-primary)]">
                {billTypeFilter === 'all' ? bills.length : stats.expenseBillCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Active {billTypeFilter === 'all' ? 'bills' : 'expense bills'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overdue/Late Bills Section */}
      {overdueBills.length > 0 && (
        <Card className={`bg-background ${billTypeFilter === 'income' ? 'border-[var(--color-warning)]/30' : 'border-[var(--color-error)]/30'}`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${billTypeFilter === 'income' ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'}`}>
              {billTypeFilter === 'income' ? (
                <Clock className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              {billTypeFilter === 'income' ? 'Late Income' : 'Overdue Bills'}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {overdueBills.length} {billTypeFilter === 'income' ? 'income source' : 'bill'}{overdueBills.length !== 1 ? 's' : ''} {billTypeFilter === 'income' ? 'not yet received' : 'need immediate attention'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueBills.map((instance) => (
              <BillItem key={instance.id} instance={instance} showDaysUntil={false} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Bills/Income Section */}
      <Card className={`bg-background ${billTypeFilter === 'income' ? 'border-[var(--color-income)]/30' : 'border-border'}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {billTypeFilter === 'income' ? (
                <ArrowDownCircle className="w-5 h-5 text-[var(--color-income)]" />
              ) : (
                <Clock className="w-5 h-5 text-[var(--color-warning)]" />
              )}
              {billTypeFilter === 'income' ? 'Expected Income' : 'Pending Bills'} ({format(pendingMonth, 'MMMM yyyy')})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingMonth(subMonths(pendingMonth, 1))}
                disabled={isSameMonth(pendingMonth, new Date())}
                className="text-muted-foreground hover:text-foreground hover:bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingMonth(addMonths(pendingMonth, 1))}
                className="text-muted-foreground hover:text-foreground hover:bg-elevated"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <CardDescription className="text-muted-foreground">
            {upcomingBills.length > 0
              ? billTypeFilter === 'income'
                ? `${upcomingBills.length} income source${upcomingBills.length !== 1 ? 's' : ''} expected`
                : `${upcomingBills.length} bill${upcomingBills.length !== 1 ? 's' : ''} pending`
              : billTypeFilter === 'income'
                ? `No expected income in ${format(pendingMonth, 'MMMM yyyy')}`
                : `No pending bills in ${format(pendingMonth, 'MMMM yyyy')}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcomingBills.length > 0 ? (
            upcomingBills.map((instance) => (
              <BillItem key={instance.id} instance={instance} />
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {billTypeFilter === 'income'
                ? `No expected income in ${format(pendingMonth, 'MMMM yyyy')}.`
                : `No pending bills in ${format(pendingMonth, 'MMMM yyyy')}.`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Paid/Received Bills Section */}
      <Card className={`bg-background ${billTypeFilter === 'income' ? 'border-[var(--color-income)]/30' : 'border-border'}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[var(--color-income)]" />
              {billTypeFilter === 'income' ? 'Received Income' : 'Paid Bills'} ({format(paidMonth, 'MMMM yyyy')})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPaidMonth(subMonths(paidMonth, 1))}
                className="text-muted-foreground hover:text-foreground hover:bg-elevated"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPaidMonth(addMonths(paidMonth, 1))}
                className="text-muted-foreground hover:text-foreground hover:bg-elevated"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <CardDescription className="text-muted-foreground">
            {paidBills.length > 0
              ? billTypeFilter === 'income'
                ? `${paidBills.length} income source${paidBills.length !== 1 ? 's' : ''} received`
                : `${paidBills.length} bill${paidBills.length !== 1 ? 's' : ''} paid`
              : billTypeFilter === 'income'
                ? `No income received in ${format(paidMonth, 'MMMM yyyy')}`
                : `No paid bills in ${format(paidMonth, 'MMMM yyyy')}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {paidBills.length > 0 ? (
            paidBills.map((instance) => (
              <BillItem key={instance.id} instance={instance} showDaysUntil={false} />
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {billTypeFilter === 'income'
                ? `No income was received in ${format(paidMonth, 'MMMM yyyy')}.`
                : `No bills were paid in ${format(paidMonth, 'MMMM yyyy')}.`}
            </p>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Bill Pay Modal */}
      <BillPayModal
        open={billPayModalOpen}
        onOpenChange={setBillPayModalOpen}
        onBillPaid={() => {
          // Trigger refresh of bill data
          window.dispatchEvent(new CustomEvent('bills-refresh'));
        }}
      />
    </div>
  );
}
