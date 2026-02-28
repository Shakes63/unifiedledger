'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, parseISO, differenceInDays, addDays, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns';
import { AlertCircle, CheckCircle2, Clock, DollarSign, Plus, ChevronLeft, ChevronRight, CalendarRange, CreditCard, Zap, Home, Shield, Banknote, Users, Wrench, MoreHorizontal, Wallet, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import { FREQUENCY_LABELS } from '@/lib/bills/bill-utils';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { type BillClassification, CLASSIFICATION_META } from '@/lib/bills/bill-classification';
import { BillPayModal } from '@/components/bills/bill-pay-modal';
import { QuickAddBillModal } from '@/components/bills/quick-add-bill-modal';
import type {
  BillOccurrenceWithTemplateDto,
  BillTemplateDto,
  RecurrenceType,
} from '@/lib/bills/contracts';

interface BillInstance {
  id: string;
  userId: string;
  billId: string;
  dueDate: string;
  expectedAmount: number;
  actualAmount?: number | null;
  paidDate?: string | null;
  transactionId?: string | null;
  status: 'pending' | 'paid' | 'overdue' | 'skipped';
  daysLate: number;
  lateFee: number;
  isManualOverride: boolean;
  notes?: string | null;
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

function toFrequency(recurrenceType: RecurrenceType): string {
  if (recurrenceType === 'one_time') return 'one-time';
  if (recurrenceType === 'semi_annual') return 'semi-annual';
  return recurrenceType;
}

function toDueDateNumber(template: BillTemplateDto): number {
  if (template.recurrenceType === 'weekly' || template.recurrenceType === 'biweekly') {
    return template.recurrenceDueWeekday ?? 0;
  }

  if (template.recurrenceType === 'one_time') {
    return Number(template.recurrenceSpecificDueDate?.split('-')[2] || '1');
  }

  return template.recurrenceDueDay ?? 1;
}

function mapTemplateToBill(template: BillTemplateDto): BillWithInstance {
  return {
    id: template.id,
    userId: template.createdByUserId,
    name: template.name,
    categoryId: template.categoryId || undefined,
    expectedAmount: template.defaultAmountCents / 100,
    dueDate: toDueDateNumber(template),
    frequency: toFrequency(template.recurrenceType),
    specificDueDate: template.recurrenceSpecificDueDate || undefined,
    startMonth: template.recurrenceStartMonth,
    isVariableAmount: template.isVariableAmount,
    amountTolerance: template.amountToleranceBps / 100,
    payeePatterns: undefined,
    accountId: template.paymentAccountId || undefined,
    isActive: template.isActive,
    autoMarkPaid: template.autoMarkPaid,
    notes: template.notes || undefined,
    createdAt: template.createdAt,
    billType: template.billType,
    billClassification: template.classification,
    classificationSubcategory: template.classificationSubcategory,
  };
}

function mapOccurrenceRowsToBillInstances(rows: BillOccurrenceWithTemplateDto[]): BillInstance[] {
  return rows.map((row) => ({
    id: row.occurrence.id,
    userId: '',
    billId: row.occurrence.templateId,
    dueDate: row.occurrence.dueDate,
    expectedAmount: row.occurrence.amountDueCents / 100,
    actualAmount:
      row.occurrence.actualAmountCents !== null ? row.occurrence.actualAmountCents / 100 : null,
    paidDate: row.occurrence.paidDate,
    transactionId: row.occurrence.lastTransactionId,
    status:
      row.occurrence.status === 'paid' || row.occurrence.status === 'overpaid'
        ? 'paid'
        : row.occurrence.status === 'overdue'
          ? 'overdue'
          : row.occurrence.status === 'skipped'
            ? 'skipped'
            : 'pending',
    daysLate: row.occurrence.daysLate,
    lateFee: row.occurrence.lateFeeCents / 100,
    isManualOverride: row.occurrence.isManualOverride,
    notes: row.occurrence.notes,
    createdAt: row.occurrence.createdAt,
    updatedAt: row.occurrence.updatedAt,
  }));
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
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>('all');
  const classificationScrollRef = useRef<HTMLDivElement>(null);
  const [billPayModalOpen, setBillPayModalOpen] = useState(false);
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [stats, setStats] = useState({
    totalUpcoming: 0,
    totalOverdue: 0,
    totalUpcomingAmount: 0,
    totalOverdueAmount: 0,
    paidThisMonth: 0,
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
        const billsRes = await fetchWithHousehold('/api/bills/templates?isActive=true&limit=100');
        if (!billsRes.ok) {
          throw new Error(`Failed to fetch bills: ${billsRes.statusText}`);
        }
        const billsData = await billsRes.json();

        // Fetch all bill instances
        const instancesRes = await fetchWithHousehold('/api/bills/occurrences?limit=1000');
        if (!instancesRes.ok) {
          throw new Error(`Failed to fetch bill instances: ${instancesRes.statusText}`);
        }
        const instancesData = await instancesRes.json();

        const billsList = Array.isArray(billsData?.data)
          ? (billsData.data as BillTemplateDto[]).map(mapTemplateToBill)
          : [];

        const rawInstances = (Array.isArray(instancesData?.data)
          ? instancesData.data
          : []) as BillOccurrenceWithTemplateDto[];
        const instancesList = mapOccurrenceRowsToBillInstances(rawInstances);

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
          const billsRes = await fetchWithHousehold('/api/bills/templates?isActive=true&limit=100');
          if (!billsRes.ok) {
            throw new Error(`Failed to fetch bills: ${billsRes.statusText}`);
          }
          const billsData = await billsRes.json();

          // Fetch all bill instances
          const instancesRes = await fetchWithHousehold('/api/bills/occurrences?limit=1000');
          if (!instancesRes.ok) {
            throw new Error(`Failed to fetch bill instances: ${instancesRes.statusText}`);
          }
          const instancesData = await instancesRes.json();

          const billsList = Array.isArray(billsData?.data)
            ? (billsData.data as BillTemplateDto[]).map(mapTemplateToBill)
            : [];

          const rawInstances = (Array.isArray(instancesData?.data)
            ? instancesData.data
            : []) as BillOccurrenceWithTemplateDto[];
          const instancesList = mapOccurrenceRowsToBillInstances(rawInstances);

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

    // Filter to expense bills only (exclude income)
    const expenseBills = billsList.filter(b => b.billType !== 'income');
    const expenseBillIds = new Set(expenseBills.map(b => b.id));

    // Expense stats
    let totalUpcoming = 0;
    let totalOverdue = 0;
    let totalUpcomingAmount = 0;
    let totalOverdueAmount = 0;
    let paidThisMonth = 0;

    instances.forEach((instance) => {
      // Skip income bill instances
      if (!expenseBillIds.has(instance.billId)) return;

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

      if (isPaid && dueDate >= monthStart && dueDate <= monthEnd) {
        paidThisMonth++;
      }
    });

    // Count bills by classification (expense only)
    const classificationCounts: Record<string, number> = {};
    expenseBills.forEach(bill => {
      const classification = bill.billClassification || 'other';
      classificationCounts[classification] = (classificationCounts[classification] || 0) + 1;
    });

    setStats({
      totalUpcoming,
      totalOverdue,
      totalUpcomingAmount,
      totalOverdueAmount,
      paidThisMonth,
      classificationCounts,
    });
  };

  // Filter instances by classification (expense bills only)
  const filterBills = (instance: BillInstance) => {
    const bill = bills.find(b => b.id === instance.billId);
    if (!bill) return false;

    // Exclude income bills - they are on the Income page now
    if (bill.billType === 'income') return false;

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
          filterBills(instance)
        );
      })
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
  };

  const getOverdueBills = () => {
    return billInstances
      .filter((instance) => instance.status === 'overdue' && filterBills(instance))
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
          filterBills(instance)
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

    return (
      <Link href={`/dashboard/bills/${instance.billId}`}>
        <div className="flex items-center justify-between px-3 py-2 bg-card border border-border rounded-md hover:bg-elevated transition-colors cursor-pointer">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {instance.status === 'paid' && <CheckCircle2 className="w-4 h-4 text-income shrink-0" />}
            {instance.status === 'overdue' && <AlertCircle className="w-4 h-4 text-error shrink-0" />}
            {instance.status === 'pending' && <Clock className="w-4 h-4 text-warning shrink-0" />}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-sm text-foreground truncate">{billName}</span>
                {bill?.frequency && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    {FREQUENCY_LABELS[bill.frequency] || bill.frequency}
                  </span>
                )}
                {bill?.billClassification && bill.billClassification !== 'other' && (
                  <span 
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ 
                      backgroundColor: `${CLASSIFICATION_META[bill.billClassification].color}15`,
                      color: CLASSIFICATION_META[bill.billClassification].color,
                    }}
                  >
                    {CLASSIFICATION_META[bill.billClassification].label}
                  </span>
                )}
                <EntityIdBadge id={instance.billId} label="Bill" />
                <EntityIdBadge id={instance.id} label="Instance" />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{format(dueDate, 'MMM d')}</span>
                {instance.status === 'overdue' && instance.daysLate > 0 && (
                  <span className="text-error">
                    {instance.daysLate}d late{instance.lateFee > 0 && ` (+$${instance.lateFee.toFixed(0)})`}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0 pl-2">
            <span className="font-mono text-sm font-medium text-foreground">${instance.expectedAmount.toFixed(2)}</span>
            {showDaysUntil && instance.status === 'pending' && (
              <p className={`text-xs ${daysUntil <= 3 ? 'text-warning' : 'text-muted-foreground'}`}>
                {daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `${daysUntil}d`}
              </p>
            )}
            {instance.status === 'paid' && <p className="text-xs text-income">Paid</p>}
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
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Bills</h1>
            <p className="text-muted-foreground mt-2">Track your recurring expenses</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setBillPayModalOpen(true)}
              className="bg-income hover:opacity-90 text-white"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Pay Bills
            </Button>
            <Link href="/dashboard/bills/annual-planning">
              <Button variant="outline" className="bg-elevated border-border text-foreground hover:bg-elevated">
                <CalendarRange className="w-4 h-4 mr-2" />
                Annual Planning
              </Button>
            </Link>
            <Link href="/dashboard/bills/new">
              <Button variant="outline" className="border-border text-muted-foreground hover:text-foreground">
                <Settings2 className="w-4 h-4 mr-2" />
                Advanced
              </Button>
            </Link>
            <Button 
              onClick={() => setQuickAddModalOpen(true)}
              className="bg-primary hover:opacity-90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              New
            </Button>
          </div>
        </div>

        {/* Filter Tabs - Classification */}
        <div className="relative">
          <div 
            ref={classificationScrollRef}
            className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
          >
            {CLASSIFICATION_FILTER_OPTIONS.map((option) => {
              const Icon = option.icon;
              // Count expense bills only
              const expenseBillCount = bills.filter(b => b.billType !== 'income').length;
              const count = option.value === 'all' 
                ? expenseBillCount 
                : (stats.classificationCounts[option.value] || 0);
              const isActive = classificationFilter === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => setClassificationFilter(option.value)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'text-white'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-border'
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

      {/* Compact Statistics Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 rounded-md">
          <Clock className="w-4 h-4 text-warning" />
          <span className="text-sm font-medium text-warning">{stats.totalUpcoming}</span>
          <span className="text-xs text-muted-foreground">due</span>
          <span className="text-xs text-muted-foreground border-l border-border pl-2">${stats.totalUpcomingAmount.toFixed(0)}</span>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-error/10 rounded-md">
          <AlertCircle className="w-4 h-4 text-error" />
          <span className="text-sm font-medium text-error">{stats.totalOverdue}</span>
          <span className="text-xs text-muted-foreground">overdue</span>
          {stats.totalOverdueAmount > 0 && (
            <span className="text-xs text-muted-foreground border-l border-border pl-2">${stats.totalOverdueAmount.toFixed(0)}</span>
          )}
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-income/10 rounded-md">
          <CheckCircle2 className="w-4 h-4 text-income" />
          <span className="text-sm font-medium text-income">{stats.paidThisMonth}</span>
          <span className="text-xs text-muted-foreground">paid</span>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-md ml-auto">
          <DollarSign className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">{bills.filter(b => b.billType !== 'income').length}</span>
          <span className="text-xs text-muted-foreground">active bills</span>
        </div>
      </div>

      {/* Overdue Bills Section */}
      {overdueBills.length > 0 && (
        <Card className="bg-background border-error/30">
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-error text-sm font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                Overdue
                <span className="text-xs font-normal text-muted-foreground">({overdueBills.length})</span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-2 space-y-1">
            {overdueBills.map((instance) => (
              <BillItem key={instance.id} instance={instance} showDaysUntil={false} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pending Bills Section */}
      <Card className="bg-background border-border">
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="w-3.5 h-3.5 text-warning" />
              Pending
              <span className="text-xs font-normal text-muted-foreground">({upcomingBills.length})</span>
            </CardTitle>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setPendingMonth(subMonths(pendingMonth, 1))}
                disabled={isSameMonth(pendingMonth, new Date())}
                aria-label="Previous month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[60px] text-center">{format(pendingMonth, 'MMM yyyy')}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setPendingMonth(addMonths(pendingMonth, 1))}
                aria-label="Next month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-3 pb-2 space-y-1">
          {upcomingBills.length > 0 ? (
            upcomingBills.map((instance) => (
              <BillItem key={instance.id} instance={instance} />
            ))
          ) : (
            <p className="text-center text-muted-foreground py-3 text-sm">
              No pending bills
            </p>
          )}
        </CardContent>
      </Card>

      {/* Paid Bills Section */}
      <Card className="bg-background border-border">
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-income" />
              Paid
              <span className="text-xs font-normal text-muted-foreground">({paidBills.length})</span>
            </CardTitle>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setPaidMonth(subMonths(paidMonth, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[60px] text-center">{format(paidMonth, 'MMM yyyy')}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setPaidMonth(addMonths(paidMonth, 1))}
                aria-label="Next month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-3 pb-2 space-y-1">
          {paidBills.length > 0 ? (
            paidBills.map((instance) => (
              <BillItem key={instance.id} instance={instance} showDaysUntil={false} />
            ))
          ) : (
            <p className="text-center text-muted-foreground py-3 text-sm">
              No paid bills
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

      {/* Quick Add Bill Modal */}
      <QuickAddBillModal
        open={quickAddModalOpen}
        onOpenChange={setQuickAddModalOpen}
        onBillCreated={() => {
          // Trigger refresh of bill data
          window.dispatchEvent(new CustomEvent('bills-refresh'));
        }}
      />
    </div>
  );
}
