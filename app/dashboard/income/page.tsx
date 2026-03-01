'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  format, parseISO, differenceInDays, addDays,
  startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth,
} from 'date-fns';
import {
  ArrowDownCircle, CheckCircle2, Clock, TrendingUp,
  Plus, ChevronLeft, ChevronRight, AlertTriangle,
  ArrowLeft, Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';
import { EntityIdBadge } from '@/components/dev/entity-id-badge';
import { FREQUENCY_LABELS } from '@/lib/bills/bill-utils';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { QuickAddIncomeModal } from '@/components/income/quick-add-income-modal';
import type { BillOccurrenceWithTemplateDto, BillTemplateDto, RecurrenceType } from '@/lib/bills/contracts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IncomeInstance {
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
  notes?: string | null;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function toFrequency(recurrenceType: RecurrenceType): string {
  if (recurrenceType === 'one_time') return 'one-time';
  if (recurrenceType === 'semi_annual') return 'semi-annual';
  return recurrenceType;
}

function toDueDateNumber(template: BillTemplateDto): number {
  if (template.recurrenceType === 'weekly' || template.recurrenceType === 'biweekly')
    return template.recurrenceDueWeekday ?? 0;
  if (template.recurrenceType === 'one_time')
    return Number(template.recurrenceSpecificDueDate?.split('-')[2] || '1');
  return template.recurrenceDueDay ?? 1;
}

function mapTemplateToIncomeSource(template: BillTemplateDto): IncomeWithInstance {
  return {
    id: template.id,
    userId: template.createdByUserId,
    name: template.name,
    categoryId: template.categoryId || undefined,
    expectedAmount: template.defaultAmountCents / 100,
    dueDate: toDueDateNumber(template),
    frequency: toFrequency(template.recurrenceType),
    specificDueDate: template.recurrenceSpecificDueDate || undefined,
    isVariableAmount: template.isVariableAmount,
    isActive: template.isActive,
    autoMarkPaid: template.autoMarkPaid,
    notes: template.notes || undefined,
    createdAt: template.createdAt,
    billType: 'income',
  };
}

function mapOccurrenceRowsToIncomeInstances(rows: BillOccurrenceWithTemplateDto[]): IncomeInstance[] {
  return rows.map(row => ({
    id: row.occurrence.id,
    userId: '',
    billId: row.occurrence.templateId,
    dueDate: row.occurrence.dueDate,
    expectedAmount: row.occurrence.amountDueCents / 100,
    actualAmount: row.occurrence.actualAmountCents !== null ? row.occurrence.actualAmountCents / 100 : null,
    paidDate: row.occurrence.paidDate,
    transactionId: row.occurrence.lastTransactionId,
    status:
      row.occurrence.status === 'paid' || row.occurrence.status === 'overpaid' ? 'paid'
      : row.occurrence.status === 'overdue' ? 'overdue'
      : row.occurrence.status === 'skipped' ? 'skipped'
      : 'pending',
    daysLate: row.occurrence.daysLate,
    notes: row.occurrence.notes,
    createdAt: row.occurrence.createdAt,
    updatedAt: row.occurrence.updatedAt,
  }));
}

// ── Income row ────────────────────────────────────────────────────────────────

function IncomeRow({
  instance,
  sources,
  showDaysUntil = true,
}: {
  instance: IncomeInstance;
  sources: IncomeWithInstance[];
  showDaysUntil?: boolean;
}) {
  const dueDate   = parseISO(instance.dueDate);
  const today     = new Date();
  const daysUntil = differenceInDays(dueDate, today);
  const source = sources.find(s => s.id === instance.billId);
  const sourceName = source?.name || 'Unknown Source';

  const isLate     = instance.status === 'overdue';
  const isReceived = instance.status === 'paid';
  const isPending  = instance.status === 'pending';

  const DotIcon = isLate ? AlertTriangle : isReceived ? CheckCircle2 : ArrowDownCircle;
  const dotColor = isLate ? 'var(--color-warning)'
    : isReceived ? 'var(--color-income)'
    : 'color-mix(in oklch, var(--color-income) 55%, transparent)';

  let statusText = '';
  let statusColor = 'var(--color-muted-foreground)';
  if (isPending && showDaysUntil) {
    if (daysUntil === 0)       { statusText = 'today';    statusColor = 'var(--color-income)'; }
    else if (daysUntil === 1)  { statusText = 'tomorrow'; statusColor = 'var(--color-income)'; }
    else if (daysUntil <= 5)   { statusText = `${daysUntil}d`;  statusColor = 'var(--color-income)'; }
    else                       { statusText = `${daysUntil}d`; }
  } else if (isLate) {
    statusText = `${instance.daysLate}d late`;
    statusColor = 'var(--color-warning)';
  } else if (isReceived) {
    statusText = 'Received';
    statusColor = 'var(--color-income)';
  }

  return (
    <Link href={`/dashboard/bills/${instance.billId}`}>
      <div
        className="group flex items-center gap-3 px-4 py-3 transition-colors"
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 50%, transparent)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        {/* Status icon */}
        <DotIcon className="w-3.5 h-3.5 shrink-0" style={{ color: dotColor }} />

        {/* Name + frequency badge */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[13px] font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
            {sourceName}
          </span>
          {source?.frequency && (
            <span
              className="text-[10px] px-1.5 py-px rounded font-medium shrink-0"
              style={{
                backgroundColor: 'color-mix(in oklch, var(--color-income) 14%, transparent)',
                color: 'var(--color-income)',
              }}
            >
              {FREQUENCY_LABELS[source.frequency] || source.frequency}
            </span>
          )}
          <EntityIdBadge id={instance.billId} label="Source" />
          <EntityIdBadge id={instance.id} label="Instance" />
        </div>

        {/* Date */}
        <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
          {format(dueDate, 'MMM d')}
        </span>

        {/* Amount — always green, always + prefix */}
        <span
          className="text-[13px] font-mono tabular-nums font-semibold shrink-0 w-20 text-right"
          style={{ color: 'var(--color-income)' }}
        >
          +${instance.expectedAmount.toFixed(2)}
        </span>

        {/* Status text */}
        <span
          className="text-[11px] font-mono tabular-nums shrink-0 w-16 text-right"
          style={{ color: statusColor }}
        >
          {statusText}
        </span>
      </div>
    </Link>
  );
}

// ── Section container ─────────────────────────────────────────────────────────

function SectionList({
  label,
  count,
  totalAmount,
  accentColor,
  children,
  emptyMessage,
  monthNav,
}: {
  label: string;
  count: number;
  totalAmount: number;
  accentColor: string;
  children: React.ReactNode;
  emptyMessage: string;
  monthNav?: React.ReactNode;
}) {
  const isWarning = accentColor === 'var(--color-warning)';
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest shrink-0" style={{ color: accentColor }}>
          {label}
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 50%, transparent)' }} />
        {monthNav}
        <span className="text-[11px] font-mono tabular-nums shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
          {count} source{count !== 1 ? 's' : ''}
          {totalAmount > 0 && (
            <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground) 55%, transparent)' }}>
              {' '}· +${totalAmount.toFixed(0)}
            </span>
          )}
        </span>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: `1px solid ${isWarning ? 'color-mix(in oklch, var(--color-warning) 30%, var(--color-border))' : 'var(--color-border)'}`,
          backgroundColor: 'var(--color-background)',
        }}
      >
        {count === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ── Month nav ─────────────────────────────────────────────────────────────────

function MonthNav({ month, onPrev, onNext, disablePrev }: {
  month: Date; onPrev: () => void; onNext: () => void; disablePrev?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        onClick={onPrev} disabled={disablePrev}
        className="w-5 h-5 flex items-center justify-center rounded disabled:opacity-30 transition-opacity"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <span className="text-[11px] tabular-nums min-w-[58px] text-center font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
        {format(month, 'MMM yyyy')}
      </span>
      <button
        onClick={onNext}
        className="w-5 h-5 flex items-center justify-center rounded transition-opacity"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function RowDivider() {
  return (
    <div className="mx-4" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 35%, transparent)' }} />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
      const [sourcesRes, instancesRes] = await Promise.all([
        fetchWithHousehold('/api/bills/templates?isActive=true&billType=income&limit=100'),
        fetchWithHousehold('/api/bills/occurrences?billType=income&limit=1000'),
      ]);
      if (!sourcesRes.ok) throw new Error(`Failed to fetch income sources: ${sourcesRes.statusText}`);
      if (!instancesRes.ok) throw new Error(`Failed to fetch income instances: ${instancesRes.statusText}`);

      const sourcesData = await sourcesRes.json();
      const instancesData = await instancesRes.json();

      const sourcesList = Array.isArray(sourcesData?.data)
        ? (sourcesData.data as BillTemplateDto[]).map(mapTemplateToIncomeSource)
        : [];
      const sourceIds = new Set(sourcesList.map(s => s.id));
      const rawInstances = (Array.isArray(instancesData?.data) ? instancesData.data : []) as BillOccurrenceWithTemplateDto[];
      const instancesList = mapOccurrenceRowsToIncomeInstances(rawInstances).filter(i => sourceIds.has(i.billId));

      setIncomeSources(sourcesList);
      setIncomeInstances(instancesList);
      calculateStats(instancesList, sourcesList);
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
    if (selectedHouseholdId) fetchData();
    else setLoading(false);
  }, [selectedHouseholdId, fetchData]);

  useEffect(() => {
    const handleRefresh = () => { if (selectedHouseholdId) fetchData(); };
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

    let totalExpected = 0, totalLate = 0, totalExpectedAmount = 0, totalLateAmount = 0;
    let receivedThisMonth = 0, receivedThisMonthAmount = 0;

    instances.forEach(i => {
      const due = parseISO(i.dueDate);
      if (i.status === 'overdue') { totalLate++; totalLateAmount += i.expectedAmount; }
      if (i.status === 'pending' && due <= thirtyDaysFromNow && due >= today) {
        totalExpected++; totalExpectedAmount += i.expectedAmount;
      }
      if (i.status === 'paid' && due >= monthStart && due <= monthEnd) {
        receivedThisMonth++; receivedThisMonthAmount += i.actualAmount || i.expectedAmount;
      }
    });

    setStats({ totalExpected, totalLate, totalExpectedAmount, totalLateAmount, receivedThisMonth, receivedThisMonthAmount, totalSources: sources.length });
  };

  const getExpectedIncome = () => {
    const s = startOfMonth(pendingMonth), e = endOfMonth(pendingMonth);
    return incomeInstances
      .filter(i => i.status === 'pending' && parseISO(i.dueDate) >= s && parseISO(i.dueDate) <= e)
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
  };

  const getLateIncome = () =>
    incomeInstances.filter(i => i.status === 'overdue')
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());

  const getReceivedIncome = () => {
    const s = startOfMonth(receivedMonth), e = endOfMonth(receivedMonth);
    return incomeInstances
      .filter(i => i.status === 'paid' && parseISO(i.dueDate) >= s && parseISO(i.dueDate) <= e)
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <div style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="w-16 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
            <div className="flex gap-2">
              <div className="w-24 h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          <div className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)' }} />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  const expectedIncome = getExpectedIncome();
  const lateIncome     = getLateIncome();
  const receivedIncome = getReceivedIncome();

  const lateTotal     = lateIncome.reduce((s, i) => s + i.expectedAmount, 0);
  const expectedTotal = expectedIncome.reduce((s, i) => s + i.expectedAmount, 0);
  const receivedTotal = receivedIncome.reduce((s, i) => s + (i.actualAmount || i.expectedAmount), 0);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50">
        <div
          className="backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
                  Income
                </h1>
                {stats.totalLate > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-px rounded-full"
                    style={{
                      backgroundColor: 'color-mix(in oklch, var(--color-warning) 18%, transparent)',
                      color: 'var(--color-warning)',
                    }}
                  >
                    {stats.totalLate} late
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/dashboard/bills/new?billType=income">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs hidden sm:flex">
                  <Settings2 className="w-3.5 h-3.5" />
                  Advanced
                </Button>
              </Link>
              <Button
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs font-medium"
                onClick={() => setQuickAddModalOpen(true)}
                style={{ backgroundColor: 'var(--color-income)', color: 'white' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Income
              </Button>
            </div>
          </div>
        </div>
        <div
          className="h-px"
          style={{
            background: 'linear-gradient(to right, transparent 5%, var(--color-border) 20%, color-mix(in oklch, var(--color-income) 45%, var(--color-border)) 50%, var(--color-border) 80%, transparent 95%)',
          }}
        />
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ── Stats strip ────────────────────────────────────────────────── */}
        <div
          className="rounded-xl px-4 py-3 flex items-center"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
        >
          {/* Late */}
          <div className="flex-1 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-warning)' }}>
              Late
            </div>
            <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: stats.totalLate > 0 ? 'var(--color-warning)' : 'var(--color-muted-foreground)' }}>
              {stats.totalLate}
            </div>
            {stats.totalLateAmount > 0 && (
              <div className="text-[10px] font-mono tabular-nums mt-0.5" style={{ color: 'var(--color-warning)' }}>
                +${stats.totalLateAmount.toFixed(0)}
              </div>
            )}
          </div>

          <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />

          {/* Expected soon */}
          <div className="flex-1 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'color-mix(in oklch, var(--color-income) 70%, var(--color-muted-foreground))' }}>
              Expected
            </div>
            <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-foreground)' }}>
              {stats.totalExpected}
            </div>
            {stats.totalExpectedAmount > 0 && (
              <div className="text-[10px] font-mono tabular-nums mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                +${stats.totalExpectedAmount.toFixed(0)}
              </div>
            )}
          </div>

          <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />

          {/* Received */}
          <div className="flex-1 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-income)' }}>
              Received
            </div>
            <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-foreground)' }}>
              {stats.receivedThisMonth}
            </div>
            {stats.receivedThisMonthAmount > 0 && (
              <div className="text-[10px] font-mono tabular-nums mt-0.5" style={{ color: 'var(--color-income)' }}>
                +${stats.receivedThisMonthAmount.toFixed(0)}
              </div>
            )}
          </div>

          <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />

          {/* Active sources */}
          <div className="flex-1 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
              Sources
            </div>
            <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-foreground)' }}>
              {stats.totalSources}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
              active
            </div>
          </div>
        </div>

        {/* ── Late Income ─────────────────────────────────────────────────── */}
        {lateIncome.length > 0 && (
          <SectionList
            label="Late"
            count={lateIncome.length}
            totalAmount={lateTotal}
            accentColor="var(--color-warning)"
            emptyMessage="No late income"
          >
            {lateIncome.map((instance, i) => (
              <div key={instance.id}>
                <IncomeRow instance={instance} sources={incomeSources} showDaysUntil={false} />
                {i < lateIncome.length - 1 && <RowDivider />}
              </div>
            ))}
          </SectionList>
        )}

        {/* ── Expected Income ─────────────────────────────────────────────── */}
        <SectionList
          label="Expected"
          count={expectedIncome.length}
          totalAmount={expectedTotal}
          accentColor="var(--color-income)"
          emptyMessage={`No expected income in ${format(pendingMonth, 'MMMM yyyy')}`}
          monthNav={
            <MonthNav
              month={pendingMonth}
              onPrev={() => setPendingMonth(subMonths(pendingMonth, 1))}
              onNext={() => setPendingMonth(addMonths(pendingMonth, 1))}
              disablePrev={isSameMonth(pendingMonth, new Date())}
            />
          }
        >
          {expectedIncome.map((instance, i) => (
            <div key={instance.id}>
              <IncomeRow instance={instance} sources={incomeSources} />
              {i < expectedIncome.length - 1 && <RowDivider />}
            </div>
          ))}
        </SectionList>

        {/* ── Received Income ─────────────────────────────────────────────── */}
        <SectionList
          label="Received"
          count={receivedIncome.length}
          totalAmount={receivedTotal}
          accentColor="var(--color-success)"
          emptyMessage={`No income received in ${format(receivedMonth, 'MMMM yyyy')}`}
          monthNav={
            <MonthNav
              month={receivedMonth}
              onPrev={() => setReceivedMonth(subMonths(receivedMonth, 1))}
              onNext={() => setReceivedMonth(addMonths(receivedMonth, 1))}
            />
          }
        >
          {receivedIncome.map((instance, i) => (
            <div key={instance.id}>
              <IncomeRow instance={instance} sources={incomeSources} showDaysUntil={false} />
              {i < receivedIncome.length - 1 && <RowDivider />}
            </div>
          ))}
        </SectionList>

        {/* Empty state — no income sources at all */}
        {stats.totalSources === 0 && !loading && (
          <div
            className="rounded-xl py-16 text-center"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
              style={{ backgroundColor: 'color-mix(in oklch, var(--color-income) 12%, transparent)' }}
            >
              <TrendingUp className="w-5 h-5" style={{ color: 'var(--color-income)' }} />
            </div>
            <p className="font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No income sources yet</p>
            <p className="text-sm mb-5" style={{ color: 'var(--color-muted-foreground)' }}>
              Add your recurring income sources to track expected payments.
            </p>
            <Button
              size="sm"
              onClick={() => setQuickAddModalOpen(true)}
              style={{ backgroundColor: 'var(--color-income)', color: 'white' }}
            >
              Add Income Source
            </Button>
          </div>
        )}
      </main>

      <QuickAddIncomeModal
        open={quickAddModalOpen}
        onOpenChange={setQuickAddModalOpen}
        onIncomeCreated={() => window.dispatchEvent(new CustomEvent('income-refresh'))}
      />
    </div>
  );
}
