'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, parseISO, differenceInDays, addDays, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns';
import { 
  ArrowDownCircle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  AlertTriangle 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import { FREQUENCY_LABELS } from '@/lib/bills/bill-utils';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { QuickAddIncomeModal } from '@/components/income/quick-add-income-modal';

interface IncomeInstance {
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
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface IncomeSource {
  id: string;
  userId: string;
  name: string;
  categoryId?: string;
  expectedAmount: number;
  dueDate: number;
  frequency: string;
  specificDueDate?: string;
  isVariableAmount: boolean;
  isActive: boolean;
  autoMarkPaid: boolean;
  notes?: string;
  createdAt: string;
  billType: 'income';
}

interface IncomeWithInstance extends IncomeSource {
  upcomingInstances?: IncomeInstance[];
}

export default function IncomeDashboard() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [incomeSources, setIncomeSources] = useState<IncomeWithInstance[]>([]);
  const [incomeInstances, setIncomeInstances] = useState<IncomeInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingMonth, setPendingMonth] = useState<Date>(new Date());
  const [receivedMonth, setReceivedMonth] = useState<Date>(new Date());
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [stats, setStats] = useState({
    totalExpected: 0,
    totalLate: 0,
    totalExpectedAmount: 0,
    totalLateAmount: 0,
    receivedThisMonth: 0,
    receivedThisMonthAmount: 0,
    totalSources: 0,
  });

  const fetchData = useCallback(async () => {
    if (!selectedHouseholdId) return;

    try {
      setLoading(true);

      // Fetch active income sources (bills with billType=income)
      const sourcesRes = await fetchWithHousehold('/api/bills?isActive=true&limit=100');
      if (!sourcesRes.ok) {
        throw new Error(`Failed to fetch income sources: ${sourcesRes.statusText}`);
      }
      const sourcesData = await sourcesRes.json();

      // Fetch all bill instances
      const instancesRes = await fetchWithHousehold('/api/bills/instances?limit=1000');
      if (!instancesRes.ok) {
        throw new Error(`Failed to fetch income instances: ${instancesRes.statusText}`);
      }
      const instancesData = await instancesRes.json();

      // Filter to income sources only
      const allBills = Array.isArray(sourcesData?.data)
        ? (sourcesData.data as Array<{ bill: IncomeWithInstance }>).map((row) => row.bill)
        : [];
      
      const incomeSourcesList = allBills.filter(bill => bill.billType === 'income');

      // Get income source IDs
      const incomeSourceIds = new Set(incomeSourcesList.map(s => s.id));

      // Filter instances to income only
      const rawInstances = Array.isArray(instancesData?.data) ? instancesData.data : [];
      const allInstances = (rawInstances as Array<{ instance: IncomeInstance; bill: IncomeWithInstance }>)
        .filter((row) => incomeSourceIds.has(row.instance.billId))
        .map((row) => ({
          ...row.instance,
          bill: row.bill,
        }));

      setIncomeSources(incomeSourcesList);
      setIncomeInstances(allInstances);
      calculateStats(allInstances, incomeSourcesList);
    } catch (error) {
      console.error('Error fetching income data:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load income sources');
      setIncomeSources([]);
      setIncomeInstances([]);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    if (selectedHouseholdId) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [selectedHouseholdId, fetchData]);

  // Listen for income refresh events
  useEffect(() => {
    const handleRefresh = () => {
      if (selectedHouseholdId) {
        fetchData();
      }
    };

    window.addEventListener('income-refresh', handleRefresh);
    window.addEventListener('bills-refresh', handleRefresh);
    return () => {
      window.removeEventListener('income-refresh', handleRefresh);
      window.removeEventListener('bills-refresh', handleRefresh);
    };
  }, [selectedHouseholdId, fetchData]);

  const calculateStats = (instances: IncomeInstance[], sources: IncomeWithInstance[]) => {
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    let totalExpected = 0;
    let totalLate = 0;
    let totalExpectedAmount = 0;
    let totalLateAmount = 0;
    let receivedThisMonth = 0;
    let receivedThisMonthAmount = 0;

    instances.forEach((instance) => {
      const dueDate = parseISO(instance.dueDate);
      const isPaid = instance.status === 'paid';
      const isOverdue = instance.status === 'overdue';
      const isPending = instance.status === 'pending';

      if (isOverdue) {
        totalLate++;
        totalLateAmount += instance.expectedAmount;
      }

      if (isPending && dueDate <= thirtyDaysFromNow && dueDate >= today) {
        totalExpected++;
        totalExpectedAmount += instance.expectedAmount;
      }

      if (isPaid && dueDate >= monthStart && dueDate <= monthEnd) {
        receivedThisMonth++;
        receivedThisMonthAmount += instance.actualAmount || instance.expectedAmount;
      }
    });

    setStats({
      totalExpected,
      totalLate,
      totalExpectedAmount,
      totalLateAmount,
      receivedThisMonth,
      receivedThisMonthAmount,
      totalSources: sources.length,
    });
  };

  const getExpectedIncome = () => {
    const monthStart = startOfMonth(pendingMonth);
    const monthEnd = endOfMonth(pendingMonth);

    return incomeInstances
      .filter((instance) => {
        const dueDate = parseISO(instance.dueDate);
        return (
          instance.status === 'pending' &&
          dueDate >= monthStart &&
          dueDate <= monthEnd
        );
      })
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
  };

  const getLateIncome = () => {
    return incomeInstances
      .filter((instance) => instance.status === 'overdue')
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
  };

  const getReceivedIncome = () => {
    const monthStart = startOfMonth(receivedMonth);
    const monthEnd = endOfMonth(receivedMonth);

    return incomeInstances
      .filter((instance) => {
        const dueDate = parseISO(instance.dueDate);
        return (
          instance.status === 'paid' &&
          dueDate >= monthStart &&
          dueDate <= monthEnd
        );
      })
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
  };

  const getSourceName = (billId: string) => {
    const source = incomeSources.find((s) => s.id === billId);
    return source?.name || 'Unknown Source';
  };

  const IncomeItem = ({ instance, showDaysUntil = true }: { instance: IncomeInstance; showDaysUntil?: boolean }) => {
    const dueDate = parseISO(instance.dueDate);
    const today = new Date();
    const daysUntil = differenceInDays(dueDate, today);
    const sourceName = getSourceName(instance.billId);
    const source = incomeSources.find((s) => s.id === instance.billId);

    return (
      <Link href={`/dashboard/bills/${instance.billId}`}>
        <div className="flex items-center justify-between p-3 bg-card border border-income/30 rounded-lg hover:bg-elevated transition-colors cursor-pointer">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-0.5">
              {instance.status === 'paid' && (
                <CheckCircle2 className="w-5 h-5 text-income" />
              )}
              {instance.status === 'overdue' && (
                <AlertTriangle className="w-5 h-5 text-warning" />
              )}
              {instance.status === 'pending' && (
                <ArrowDownCircle className="w-5 h-5 text-income/60" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-foreground">{sourceName}</p>
                {source && source.frequency && (
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-income/10 text-income border-income/20">
                    {FREQUENCY_LABELS[source.frequency] || source.frequency}
                  </span>
                )}
                <EntityIdBadge id={instance.billId} label="Source" />
                <EntityIdBadge id={instance.id} label="Instance" />
              </div>
              <p className="text-sm text-muted-foreground">
                Expected: {format(dueDate, 'MMM d, yyyy')}
              </p>
              {instance.status === 'overdue' && instance.daysLate > 0 && (
                <p className="text-sm text-warning">
                  {instance.daysLate} day{instance.daysLate !== 1 ? 's' : ''} late
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium text-income">
              +${instance.expectedAmount.toFixed(2)}
            </p>
            {showDaysUntil && instance.status === 'pending' && (
              <p className={`text-sm ${daysUntil <= 3 ? 'text-income' : 'text-muted-foreground'}`}>
                {daysUntil === 0 && 'Expected today'}
                {daysUntil === 1 && 'Expected tomorrow'}
                {daysUntil > 1 && `${daysUntil} days`}
              </p>
            )}
            {instance.status === 'paid' && (
              <p className="text-sm text-income">Received</p>
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

  const expectedIncome = getExpectedIncome();
  const lateIncome = getLateIncome();
  const receivedIncome = getReceivedIncome();

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Income</h1>
            <p className="text-muted-foreground mt-2">Track your recurring income sources</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/bills/new?billType=income">
              <Button variant="outline" className="border-border text-muted-foreground hover:text-foreground">
                Advanced
              </Button>
            </Link>
            <Button 
              onClick={() => setQuickAddModalOpen(true)}
              className="bg-income hover:opacity-90 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Income
            </Button>
          </div>
        </div>

        {/* Statistics Cards - Compact with inline layout on larger screens */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-card border border-income/30 rounded-lg px-3 py-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0.5 md:gap-2">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <ArrowDownCircle className="w-3.5 h-3.5 text-income" />
                Expected
              </div>
              <span className="text-lg md:text-base font-bold text-income">{stats.totalExpected}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 md:text-right">
              +${stats.totalExpectedAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-card border border-warning/30 rounded-lg px-3 py-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0.5 md:gap-2">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Clock className="w-3.5 h-3.5 text-warning" />
                Late
              </div>
              <span className="text-lg md:text-base font-bold text-warning">{stats.totalLate}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 md:text-right">
              +${stats.totalLateAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-card border border-income/30 rounded-lg px-3 py-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0.5 md:gap-2">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-income" />
                Received
              </div>
              <span className="text-lg md:text-base font-bold text-income">{stats.receivedThisMonth}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 md:text-right">
              +${stats.receivedThisMonthAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div className="bg-card border border-income/30 rounded-lg px-3 py-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0.5 md:gap-2">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-income" />
                Sources
              </div>
              <span className="text-lg md:text-base font-bold text-income">{stats.totalSources}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 md:text-right">
              Active streams
            </p>
          </div>
        </div>

        {/* Late Income Section */}
        {lateIncome.length > 0 && (
          <Card className="bg-background border-warning/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertTriangle className="w-5 h-5" />
                Late Income
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {lateIncome.length} income source{lateIncome.length !== 1 ? 's' : ''} not yet received
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {lateIncome.map((instance) => (
                <IncomeItem key={instance.id} instance={instance} showDaysUntil={false} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Expected Income Section */}
        <Card className="bg-background border-income/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ArrowDownCircle className="w-5 h-5 text-income" />
                Expected Income ({format(pendingMonth, 'MMMM yyyy')})
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
              {expectedIncome.length > 0
                ? `${expectedIncome.length} income source${expectedIncome.length !== 1 ? 's' : ''} expected`
                : `No expected income in ${format(pendingMonth, 'MMMM yyyy')}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {expectedIncome.length > 0 ? (
              expectedIncome.map((instance) => (
                <IncomeItem key={instance.id} instance={instance} />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No expected income in {format(pendingMonth, 'MMMM yyyy')}.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Received Income Section */}
        <Card className="bg-background border-income/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-income" />
                Received Income ({format(receivedMonth, 'MMMM yyyy')})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReceivedMonth(subMonths(receivedMonth, 1))}
                  className="text-muted-foreground hover:text-foreground hover:bg-elevated"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReceivedMonth(addMonths(receivedMonth, 1))}
                  className="text-muted-foreground hover:text-foreground hover:bg-elevated"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <CardDescription className="text-muted-foreground">
              {receivedIncome.length > 0
                ? `${receivedIncome.length} income source${receivedIncome.length !== 1 ? 's' : ''} received`
                : `No income received in ${format(receivedMonth, 'MMMM yyyy')}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {receivedIncome.length > 0 ? (
              receivedIncome.map((instance) => (
                <IncomeItem key={instance.id} instance={instance} showDaysUntil={false} />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No income was received in {format(receivedMonth, 'MMMM yyyy')}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Add Income Modal */}
      <QuickAddIncomeModal
        open={quickAddModalOpen}
        onOpenChange={setQuickAddModalOpen}
        onIncomeCreated={() => {
          window.dispatchEvent(new CustomEvent('income-refresh'));
        }}
      />
    </div>
  );
}

