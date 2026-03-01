'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  format, parseISO, differenceInDays, addDays,
  startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth,
} from 'date-fns';
import {
  AlertCircle, CheckCircle2, Clock, Plus,
  ChevronLeft, ChevronRight, CalendarRange, Wallet,
  Settings2, ArrowLeft, CreditCard, Zap, Home, Shield,
  Banknote, Users, Wrench, MoreHorizontal, SkipForward,
} from 'lucide-react';
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
import type { BillOccurrenceWithTemplateDto, BillTemplateDto, RecurrenceType } from '@/lib/bills/contracts';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  startMonth?: number | null;
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

interface BillWithInstance extends Bill {
  upcomingInstances?: BillInstance[];
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
    actualAmount: row.occurrence.actualAmountCents !== null ? row.occurrence.actualAmountCents / 100 : null,
    paidDate: row.occurrence.paidDate,
    transactionId: row.occurrence.lastTransactionId,
    status:
      row.occurrence.status === 'paid' || row.occurrence.status === 'overpaid' ? 'paid'
      : row.occurrence.status === 'overdue' ? 'overdue'
      : row.occurrence.status === 'skipped' ? 'skipped'
      : 'pending',
    daysLate: row.occurrence.daysLate,
    lateFee: row.occurrence.lateFeeCents / 100,
    isManualOverride: row.occurrence.isManualOverride,
    notes: row.occurrence.notes,
    createdAt: row.occurrence.createdAt,
    updatedAt: row.occurrence.updatedAt,
  }));
}

// ── Classification filter config ──────────────────────────────────────────────

const FILTER_OPTIONS: Array<{
  value: ClassificationFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { value: 'all',           label: 'All',           icon: MoreHorizontal, color: '#6b7280' },
  { value: 'subscription',  label: 'Subscriptions', icon: CreditCard,     color: CLASSIFICATION_META.subscription.color },
  { value: 'utility',       label: 'Utilities',     icon: Zap,            color: CLASSIFICATION_META.utility.color },
  { value: 'housing',       label: 'Housing',       icon: Home,           color: CLASSIFICATION_META.housing.color },
  { value: 'insurance',     label: 'Insurance',     icon: Shield,         color: CLASSIFICATION_META.insurance.color },
  { value: 'loan_payment',  label: 'Loans',         icon: Banknote,       color: CLASSIFICATION_META.loan_payment.color },
  { value: 'membership',    label: 'Memberships',   icon: Users,          color: CLASSIFICATION_META.membership.color },
  { value: 'service',       label: 'Services',      icon: Wrench,         color: CLASSIFICATION_META.service.color },
  { value: 'other',         label: 'Other',         icon: MoreHorizontal, color: CLASSIFICATION_META.other.color },
];

// ── Bill row (single line, dense) ─────────────────────────────────────────────

function BillRow({
  instance,
  bills,
  showDaysUntil = true,
}: {
  instance: BillInstance;
  bills: BillWithInstance[];
  showDaysUntil?: boolean;
}) {
  const dueDate  = parseISO(instance.dueDate);
  const today    = new Date();
  const daysUntil = differenceInDays(dueDate, today);
  const bill = bills.find(b => b.id === instance.billId);
  const billName = bill?.name || 'Unknown Bill';

  const isOverdue = instance.status === 'overdue';
  const isPaid    = instance.status === 'paid';
  const isPending = instance.status === 'pending';
  const isSkipped = instance.status === 'skipped';

  const dotColor = isOverdue ? 'var(--color-error)'
    : isPaid    ? 'var(--color-success)'
    : isPending ? 'var(--color-warning)'
    : 'var(--color-muted-foreground)';

  const DotIcon = isOverdue ? AlertCircle
    : isPaid    ? CheckCircle2
    : isSkipped ? SkipForward
    : Clock;

  // Days indicator text + color
  let daysText = '';
  let daysColor = 'var(--color-muted-foreground)';
  if (isPending && showDaysUntil) {
    if (daysUntil === 0)      { daysText = 'today';       daysColor = 'var(--color-warning)'; }
    else if (daysUntil === 1) { daysText = 'tomorrow';    daysColor = 'var(--color-warning)'; }
    else if (daysUntil <= 3)  { daysText = `${daysUntil}d`; daysColor = 'var(--color-warning)'; }
    else                      { daysText = `${daysUntil}d`; }
  } else if (isOverdue) {
    daysText = `${instance.daysLate}d late`;
    daysColor = 'var(--color-error)';
  } else if (isPaid) {
    daysText = 'Paid';
    daysColor = 'var(--color-success)';
  } else if (isSkipped) {
    daysText = 'Skipped';
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

        {/* Name + badges */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span
            className="text-[13px] font-medium truncate"
            style={{ color: 'var(--color-foreground)' }}
          >
            {billName}
          </span>
          {bill?.frequency && (
            <span
              className="text-[10px] px-1.5 py-px rounded font-medium shrink-0"
              style={{
                backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)',
                color: 'var(--color-primary)',
              }}
            >
              {FREQUENCY_LABELS[bill.frequency] || bill.frequency}
            </span>
          )}
          {bill?.billClassification && bill.billClassification !== 'other' && (
            <span
              className="text-[10px] px-1.5 py-px rounded font-medium shrink-0 hidden sm:inline"
              style={{
                backgroundColor: `${CLASSIFICATION_META[bill.billClassification].color}18`,
                color: CLASSIFICATION_META[bill.billClassification].color,
              }}
            >
              {CLASSIFICATION_META[bill.billClassification].label}
            </span>
          )}
          <EntityIdBadge id={instance.billId} label="Bill" />
          <EntityIdBadge id={instance.id} label="Instance" />
        </div>

        {/* Due date */}
        <span
          className="text-[11px] tabular-nums shrink-0"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          {format(dueDate, 'MMM d')}
        </span>

        {/* Amount */}
        <span
          className="text-[13px] font-mono tabular-nums font-semibold shrink-0 w-20 text-right"
          style={{ color: 'var(--color-foreground)' }}
        >
          ${instance.expectedAmount.toFixed(2)}
        </span>

        {/* Status indicator */}
        <span
          className="text-[11px] font-mono tabular-nums shrink-0 w-16 text-right"
          style={{ color: daysColor }}
        >
          {daysText}
          {isOverdue && instance.lateFee > 0 && (
            <span className="block text-[10px]">+${instance.lateFee.toFixed(0)}</span>
          )}
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
  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-widest shrink-0"
          style={{ color: accentColor }}
        >
          {label}
        </span>
        <div
          className="flex-1 h-px"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 50%, transparent)' }}
        />
        {monthNav}
        <span
          className="text-[11px] font-mono tabular-nums shrink-0"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          {count} bill{count !== 1 ? 's' : ''}
          {totalAmount > 0 && (
            <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground) 55%, transparent)' }}>
              {' '}· ${totalAmount.toFixed(0)}
            </span>
          )}
        </span>
      </div>

      {/* Connected list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: `1px solid ${accentColor === 'var(--color-error)' ? 'color-mix(in oklch, var(--color-error) 30%, var(--color-border))' : 'var(--color-border)'}`,
          backgroundColor: 'var(--color-background)',
        }}
      >
        {count === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
              {emptyMessage}
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ── Month nav ─────────────────────────────────────────────────────────────────

function MonthNav({
  month,
  onPrev,
  onNext,
  disablePrev,
}: {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  disablePrev?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        onClick={onPrev}
        disabled={disablePrev}
        className="w-5 h-5 flex items-center justify-center rounded disabled:opacity-30 transition-opacity"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <span
        className="text-[11px] tabular-nums min-w-[58px] text-center font-medium"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
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

// ── Row divider ───────────────────────────────────────────────────────────────

function RowDivider() {
  return (
    <div
      className="mx-4"
      style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 35%, transparent)' }}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [billPayModalOpen, setBillPayModalOpen] = useState(false);
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [stats, setStats] = useState({
    totalUpcoming: 0,
    totalOverdue: 0,
    totalUpcomingAmount: 0,
    totalOverdueAmount: 0,
    paidThisMonth: 0,
    classificationCounts: {} as Record<string, number>,
  });

  // Deep link from calendar
  useEffect(() => {
    const billPay = searchParams.get('billPay');
    const payBill = searchParams.get('payBill');
    if (billPay === '1' || payBill) setBillPayModalOpen(true);
  }, [searchParams]);

  const fetchData = async () => {
    if (!selectedHouseholdId) { setLoading(false); return; }
    try {
      setLoading(true);
      const [billsRes, instancesRes] = await Promise.all([
        fetchWithHousehold('/api/bills/templates?isActive=true&limit=100'),
        fetchWithHousehold('/api/bills/occurrences?limit=1000'),
      ]);
      if (!billsRes.ok) throw new Error(`Failed to fetch bills: ${billsRes.statusText}`);
      if (!instancesRes.ok) throw new Error(`Failed to fetch instances: ${instancesRes.statusText}`);

      const billsData = await billsRes.json();
      const instancesData = await instancesRes.json();

      const billsList = Array.isArray(billsData?.data)
        ? (billsData.data as BillTemplateDto[]).map(mapTemplateToBill)
        : [];
      const rawInstances = (Array.isArray(instancesData?.data) ? instancesData.data : []) as BillOccurrenceWithTemplateDto[];
      const instancesList = mapOccurrenceRowsToBillInstances(rawInstances);

      setBills(billsList);
      setBillInstances(instancesList);
      calculateStats(instancesList, billsList);
    } catch (error) {
      console.error('Error fetching bills:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load bills');
      setBills([]);
      setBillInstances([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedHouseholdId, fetchWithHousehold]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleRefresh = () => { fetchData(); };
    window.addEventListener('bills-refresh', handleRefresh);
    return () => window.removeEventListener('bills-refresh', handleRefresh);
  }, [selectedHouseholdId, fetchWithHousehold]); // eslint-disable-line react-hooks/exhaustive-deps

  const calculateStats = (instances: BillInstance[], billsList: BillWithInstance[]) => {
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const expenseBills = billsList.filter(b => b.billType !== 'income');
    const expenseBillIds = new Set(expenseBills.map(b => b.id));

    let totalUpcoming = 0, totalOverdue = 0, totalUpcomingAmount = 0, totalOverdueAmount = 0, paidThisMonth = 0;
    instances.forEach(inst => {
      if (!expenseBillIds.has(inst.billId)) return;
      const due = parseISO(inst.dueDate);
      if (inst.status === 'overdue') { totalOverdue++; totalOverdueAmount += inst.expectedAmount; }
      if (inst.status === 'pending' && due <= thirtyDaysFromNow && due >= today) { totalUpcoming++; totalUpcomingAmount += inst.expectedAmount; }
      if (inst.status === 'paid' && due >= monthStart && due <= monthEnd) paidThisMonth++;
    });

    const classificationCounts: Record<string, number> = {};
    expenseBills.forEach(b => {
      const c = b.billClassification || 'other';
      classificationCounts[c] = (classificationCounts[c] || 0) + 1;
    });

    setStats({ totalUpcoming, totalOverdue, totalUpcomingAmount, totalOverdueAmount, paidThisMonth, classificationCounts });
  };

  const filterBills = (instance: BillInstance) => {
    const bill = bills.find(b => b.id === instance.billId);
    if (!bill) return false;
    if (bill.billType === 'income') return false;
    if (classificationFilter !== 'all') {
      if ((bill.billClassification || 'other') !== classificationFilter) return false;
    }
    return true;
  };

  const getUpcomingBills = () => {
    const s = startOfMonth(pendingMonth), e = endOfMonth(pendingMonth);
    return billInstances
      .filter(i => i.status === 'pending' && parseISO(i.dueDate) >= s && parseISO(i.dueDate) <= e && filterBills(i))
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());
  };

  const getOverdueBills = () =>
    billInstances.filter(i => i.status === 'overdue' && filterBills(i))
      .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());

  const getPaidBills = () => {
    const s = startOfMonth(paidMonth), e = endOfMonth(paidMonth);
    return billInstances
      .filter(i => i.status === 'paid' && parseISO(i.dueDate) >= s && parseISO(i.dueDate) <= e && filterBills(i))
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
              <div className="w-20 h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          <div className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)' }} />
          <div className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)' }} />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  const upcomingBills = getUpcomingBills();
  const overdueBills  = getOverdueBills();
  const paidBills     = getPaidBills();
  const activeBillCount = bills.filter(b => b.billType !== 'income').length;

  const overdueTotal  = overdueBills.reduce((s, i) => s + i.expectedAmount, 0);
  const pendingTotal  = upcomingBills.reduce((s, i) => s + i.expectedAmount, 0);
  const paidTotal     = paidBills.reduce((s, i) => s + i.expectedAmount, 0);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50">
        <div
          className="backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
        >
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
            {/* Left: back + title + overdue badge */}
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
                  Bills
                </h1>
                {stats.totalOverdue > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-px rounded-full"
                    style={{
                      backgroundColor: 'color-mix(in oklch, var(--color-error) 18%, transparent)',
                      color: 'var(--color-error)',
                    }}
                  >
                    {stats.totalOverdue} overdue
                  </span>
                )}
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2">
              <Link href="/dashboard/bills/annual-planning">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs hidden sm:flex">
                  <CalendarRange className="w-3.5 h-3.5" />
                  Annual
                </Button>
              </Link>
              <Link href="/dashboard/bills/new">
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5 text-xs hidden sm:flex">
                  <Settings2 className="w-3.5 h-3.5" />
                  Advanced
                </Button>
              </Link>
              <Button
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs font-medium"
                onClick={() => setBillPayModalOpen(true)}
                style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 85%, var(--color-foreground))', color: 'white' }}
              >
                <Wallet className="w-3.5 h-3.5" />
                Pay Bills
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs font-medium"
                onClick={() => setQuickAddModalOpen(true)}
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </Button>
            </div>
          </div>
        </div>
        <div
          className="h-px"
          style={{
            background: 'linear-gradient(to right, transparent 5%, var(--color-border) 20%, color-mix(in oklch, var(--color-primary) 45%, var(--color-border)) 50%, var(--color-border) 80%, transparent 95%)',
          }}
        />
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ── Stats strip ────────────────────────────────────────────────── */}
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-0"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
        >
          {/* Overdue */}
          <div className="flex-1 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-error)' }}>
              Overdue
            </div>
            <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: stats.totalOverdue > 0 ? 'var(--color-error)' : 'var(--color-muted-foreground)' }}>
              {stats.totalOverdue}
            </div>
            {stats.totalOverdueAmount > 0 && (
              <div className="text-[10px] font-mono tabular-nums mt-0.5" style={{ color: 'var(--color-error)' }}>
                ${stats.totalOverdueAmount.toFixed(0)}
              </div>
            )}
          </div>

          <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />

          {/* Due soon */}
          <div className="flex-1 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-warning)' }}>
              Due soon
            </div>
            <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-foreground)' }}>
              {stats.totalUpcoming}
            </div>
            {stats.totalUpcomingAmount > 0 && (
              <div className="text-[10px] font-mono tabular-nums mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                ${stats.totalUpcomingAmount.toFixed(0)}
              </div>
            )}
          </div>

          <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />

          {/* Paid this month */}
          <div className="flex-1 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-success)' }}>
              Paid
            </div>
            <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-foreground)' }}>
              {stats.paidThisMonth}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
              this month
            </div>
          </div>

          <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />

          {/* Active bills */}
          <div className="flex-1 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
              Active
            </div>
            <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-foreground)' }}>
              {activeBillCount}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
              bills
            </div>
          </div>
        </div>

        {/* ── Classification filter ───────────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {FILTER_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const count = opt.value === 'all'
              ? bills.filter(b => b.billType !== 'income').length
              : (stats.classificationCounts[opt.value] || 0);
            const isActive = classificationFilter === opt.value;
            if (opt.value !== 'all' && count === 0) return null;

            return (
              <button
                key={opt.value}
                onClick={() => setClassificationFilter(opt.value)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: isActive ? opt.color : 'var(--color-elevated)',
                  color: isActive ? 'white' : 'var(--color-muted-foreground)',
                  border: `1px solid ${isActive ? opt.color : 'var(--color-border)'}`,
                }}
              >
                <Icon className="w-3 h-3" />
                {opt.label}
                <span
                  className="text-[10px] px-1 py-px rounded-full"
                  style={{
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'var(--color-elevated)',
                    color: isActive ? 'white' : 'var(--color-muted-foreground)',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Overdue ─────────────────────────────────────────────────────── */}
        {overdueBills.length > 0 && (
          <SectionList
            label="Overdue"
            count={overdueBills.length}
            totalAmount={overdueTotal}
            accentColor="var(--color-error)"
            emptyMessage="No overdue bills"
          >
            {overdueBills.map((instance, i) => (
              <div key={instance.id}>
                <BillRow instance={instance} bills={bills} showDaysUntil={false} />
                {i < overdueBills.length - 1 && <RowDivider />}
              </div>
            ))}
          </SectionList>
        )}

        {/* ── Pending ─────────────────────────────────────────────────────── */}
        <SectionList
          label="Pending"
          count={upcomingBills.length}
          totalAmount={pendingTotal}
          accentColor="var(--color-warning)"
          emptyMessage={`No pending bills in ${format(pendingMonth, 'MMMM yyyy')}`}
          monthNav={
            <MonthNav
              month={pendingMonth}
              onPrev={() => setPendingMonth(subMonths(pendingMonth, 1))}
              onNext={() => setPendingMonth(addMonths(pendingMonth, 1))}
              disablePrev={isSameMonth(pendingMonth, new Date())}
            />
          }
        >
          {upcomingBills.map((instance, i) => (
            <div key={instance.id}>
              <BillRow instance={instance} bills={bills} />
              {i < upcomingBills.length - 1 && <RowDivider />}
            </div>
          ))}
        </SectionList>

        {/* ── Paid ────────────────────────────────────────────────────────── */}
        <SectionList
          label="Paid"
          count={paidBills.length}
          totalAmount={paidTotal}
          accentColor="var(--color-success)"
          emptyMessage={`No paid bills in ${format(paidMonth, 'MMMM yyyy')}`}
          monthNav={
            <MonthNav
              month={paidMonth}
              onPrev={() => setPaidMonth(subMonths(paidMonth, 1))}
              onNext={() => setPaidMonth(addMonths(paidMonth, 1))}
            />
          }
        >
          {paidBills.map((instance, i) => (
            <div key={instance.id}>
              <BillRow instance={instance} bills={bills} showDaysUntil={false} />
              {i < paidBills.length - 1 && <RowDivider />}
            </div>
          ))}
        </SectionList>
      </main>

      <BillPayModal
        open={billPayModalOpen}
        onOpenChange={setBillPayModalOpen}
        onBillPaid={() => window.dispatchEvent(new CustomEvent('bills-refresh'))}
      />
      <QuickAddBillModal
        open={quickAddModalOpen}
        onOpenChange={setQuickAddModalOpen}
        onBillCreated={() => window.dispatchEvent(new CustomEvent('bills-refresh'))}
      />
    </div>
  );
}
