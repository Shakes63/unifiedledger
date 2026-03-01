'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DebtForm } from '@/components/debts/debt-form';
import { DebtPayoffStrategy } from '@/components/debts/debt-payoff-strategy';
import { WhatIfCalculator } from '@/components/debts/what-if-calculator';
import { MinimumPaymentWarning } from '@/components/debts/minimum-payment-warning';
import { PaymentAdherenceCard } from '@/components/debts/payment-adherence-card';
import { PaymentStreakWidget } from '@/components/debts/payment-streak-widget';
import { DebtFreeCountdown } from '@/components/dashboard/debt-free-countdown';
import { UnifiedDebtCard, type UnifiedDebt } from '@/components/debts/unified-debt-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus,
  ArrowLeft,
  Target,
  BarChart3,
  Lightbulb,
  AlertTriangle,
  CreditCard,
  Wallet,
  FileText,
  Layers,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Loader2,
  Settings,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { UtilizationTrendsChart, BalanceHistoryChart, InterestPaidChart } from '@/components/charts';
import type { DebtFormData } from '@/lib/types';

interface UnifiedDebtSummary {
  totalBalance: number;
  totalMinimumPayment: number;
  totalCount: number;
  creditAccountCount: number;
  debtBillCount: number;
  standaloneDebtCount: number;
  inStrategyCount: number;
  strategyBalance: number;
}

interface DebtStats {
  activeDebtCount: number;
  totalRemainingBalance: number;
  totalPaidOff: number;
  percentagePaidOff: number;
}

interface DebtSettings {
  debtStrategyEnabled?: boolean;
  preferredMethod?: 'avalanche' | 'snowball';
  extraMonthlyPayment?: number;
  paymentFrequency?: 'weekly' | 'biweekly' | 'monthly';
}

type PayoffMethod = 'avalanche' | 'snowball';

interface RolldownPayment {
  debtId: string;
  payoffMonth?: number;
  payoffDate?: string;
  minimumOnlyMonths?: number;
  order?: number;
  monthsToPayoff?: number;
  totalInterestPaid?: number;
}

type StrategyData = Partial<Record<PayoffMethod, { rolldownPayments?: RolldownPayment[] }>>;

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Compact analytics section row
function AnalyticsRow({
  icon: Icon,
  label,
  description,
  accentColor,
  open,
  onToggle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  accentColor: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '0.75rem', overflow: 'hidden', backgroundColor: 'var(--color-background)' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 60%, transparent)')}
        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in oklch, ${accentColor} 14%, transparent)` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>{label}</span>
          <span className="text-[11px] ml-2" style={{ color: 'var(--color-muted-foreground)' }}>{description}</span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
          : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />}
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function DebtsPage() {
  const { selectedHouseholdId } = useHousehold();
  const {
    fetchWithHousehold,
    postWithHousehold,
    putWithHousehold,
    deleteWithHousehold,
  } = useHouseholdFetch();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<(Partial<DebtFormData> & { id: string }) | null>(null);
  const [stats, setStats] = useState<DebtStats | null>(null);
  const [showMinWarning, setShowMinWarning] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [showPaymentTracking, setShowPaymentTracking] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [debtSettings, setDebtSettings] = useState<DebtSettings | null>(null);
  const [allExpanded, setAllExpanded] = useState<boolean | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [savingStrategy, setSavingStrategy] = useState(false);
  const [strategyData, setStrategyData] = useState<StrategyData | null>(null);
  const [unifiedDebts, setUnifiedDebts] = useState<UnifiedDebt[]>([]);
  const [unifiedSummary, setUnifiedSummary] = useState<UnifiedDebtSummary | null>(null);
  const [unifiedLoading, setUnifiedLoading] = useState(true);
  const [unifiedFilter, setUnifiedFilter] = useState<'all' | 'credit' | 'line_of_credit' | 'loans'>('all');

  const triggerRefresh = useCallback(() => setRefreshKey(p => p + 1), []);

  const loadUnifiedDebts = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      setUnifiedLoading(true);
      const params = new URLSearchParams();
      if (unifiedFilter === 'credit') params.set('type', 'credit');
      else if (unifiedFilter === 'line_of_credit') params.set('type', 'line_of_credit');
      else if (unifiedFilter === 'loans') params.set('source', 'bill');
      const url = `/api/debts/unified${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetchWithHousehold(url);
      if (res.ok) {
        const data = await res.json();
        setUnifiedDebts(data.debts);
        setUnifiedSummary(data.summary);
      }
    } catch (err) {
      console.error('Error loading unified debts:', err);
    } finally {
      setUnifiedLoading(false);
    }
  }, [selectedHouseholdId, unifiedFilter, fetchWithHousehold]);

  const loadSettings = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      const res = await fetchWithHousehold('/api/debts/settings');
      if (res.ok) setDebtSettings((await res.json()) as DebtSettings);
    } catch (err) {
      console.error('Error loading debt settings:', err);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  const loadStats = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      const res = await fetchWithHousehold('/api/debts/stats');
      if (res.ok) setStats((await res.json()) as DebtStats);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  const loadStrategyData = useCallback(async () => {
    if (!selectedHouseholdId || !debtSettings) return;
    try {
      const extra = debtSettings.extraMonthlyPayment || 0;
      const res = await fetchWithHousehold(`/api/debts/payoff-strategy?compare=true&extraPayment=${extra}`);
      if (res.ok) setStrategyData((await res.json()) as StrategyData);
    } catch (err) {
      console.error('Error loading strategy data:', err);
    }
  }, [selectedHouseholdId, debtSettings, fetchWithHousehold]);

  useEffect(() => {
    if (!selectedHouseholdId) return;
    loadStats();
    loadSettings();
    loadUnifiedDebts();
  }, [selectedHouseholdId, loadStats, loadSettings, loadUnifiedDebts]);

  useEffect(() => { loadUnifiedDebts(); }, [unifiedFilter, loadUnifiedDebts, refreshKey]);
  useEffect(() => { if (debtSettings) loadStrategyData(); }, [debtSettings, loadStrategyData, refreshKey]);

  const loadDebtDetails = async (debtId: string) => {
    if (!selectedHouseholdId) { toast.error('Please select a household'); return null; }
    try {
      const res = await fetchWithHousehold(`/api/debts/${debtId}`);
      if (!res.ok) throw new Error();
      return await res.json();
    } catch { toast.error('Failed to load debt details'); return null; }
  };

  const handleCreateDebt = async (data: Record<string, unknown>, saveMode: 'save' | 'saveAndAdd' = 'save') => {
    if (!selectedHouseholdId) { toast.error('Please select a household'); return; }
    try {
      const res = await postWithHousehold('/api/debts', data);
      if (!res.ok) throw new Error();
      if (saveMode === 'saveAndAdd') {
        toast.success(`"${typeof data.name === 'string' ? data.name : 'Debt'}" saved!`);
      } else {
        toast.success('Debt added!');
        setIsFormOpen(false);
        setSelectedDebt(null);
      }
      loadStats(); loadUnifiedDebts(); triggerRefresh();
    } catch { toast.error('Failed to add debt'); }
  };

  const handleUpdateDebt = async (data: Record<string, unknown>) => {
    if (!selectedDebt || !selectedHouseholdId) { toast.error('Please select a household'); return; }
    try {
      const res = await putWithHousehold(`/api/debts/${selectedDebt.id}`, data);
      if (!res.ok) throw new Error();
      toast.success('Debt updated!');
      setIsFormOpen(false); setSelectedDebt(null);
      loadStats(); loadUnifiedDebts(); triggerRefresh();
    } catch { toast.error('Failed to update debt'); }
  };

  const handleDeleteDebt = async (debtId: string) => {
    if (!confirm('Delete this debt? This cannot be undone.')) return;
    if (!selectedHouseholdId) { toast.error('Please select a household'); return; }
    try {
      const res = await deleteWithHousehold(`/api/debts/${debtId}`);
      if (!res.ok) throw new Error();
      toast.success('Debt deleted.');
      loadStats(); loadUnifiedDebts(); triggerRefresh();
    } catch { toast.error('Failed to delete debt'); }
  };

  const handleEditDebt = async (debt: { id: string }) => {
    const details = await loadDebtDetails(debt.id);
    if (details) { setSelectedDebt(details as Partial<DebtFormData> & { id: string }); setIsFormOpen(true); }
  };

  const handlePayment = () => { loadStats(); loadUnifiedDebts(); triggerRefresh(); };

  const handleToggleStrategy = async (enabled: boolean) => {
    if (!selectedHouseholdId) { toast.error('Please select a household'); return; }
    setSavingStrategy(true);
    try {
      const res = await putWithHousehold('/api/debts/settings', { ...(debtSettings ?? {}), debtStrategyEnabled: enabled });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setDebtSettings(p => ({ ...(p ?? {}), debtStrategyEnabled: enabled }));
      toast.success(enabled ? 'Strategy enabled' : 'Strategy disabled');
      triggerRefresh(); loadUnifiedDebts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update strategy');
    } finally { setSavingStrategy(false); }
  };

  const hasDebts = (stats?.activeDebtCount ?? 0) > 0;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (unifiedLoading && !stats) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <div style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="w-28 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
            <div className="w-24 h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          <div className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)' }} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50">
        <div
          className="backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
            {/* Back */}
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>

            {/* Title */}
            <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
              Debt Payoff
            </h1>

            {/* Total balance pill */}
            {unifiedSummary && unifiedSummary.totalBalance > 0 && (
              <span
                className="text-[12px] font-bold font-mono tabular-nums px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'color-mix(in oklch, var(--color-error) 12%, transparent)',
                  color: 'var(--color-error)',
                }}
              >
                −${fmt(unifiedSummary.totalBalance)}
              </span>
            )}

            <div className="flex-1" />

            {/* Strategy toggle (if debts exist) */}
            {hasDebts && debtSettings && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-default"
                      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
                    >
                      <Target
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: debtSettings.debtStrategyEnabled ? 'var(--color-success)' : 'var(--color-muted-foreground)' }}
                      />
                      <span className="text-[11px] font-medium hidden sm:block" style={{ color: 'var(--color-foreground)' }}>
                        {debtSettings.debtStrategyEnabled
                          ? (debtSettings.preferredMethod === 'avalanche' ? 'Avalanche' : 'Snowball')
                          : 'No Strategy'}
                      </span>
                      <Link href="/dashboard/settings?tab=household-financial">
                        <Settings className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />
                      </Link>
                      {savingStrategy
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-muted-foreground)' }} />
                        : <Switch
                            checked={debtSettings.debtStrategyEnabled ?? false}
                            onCheckedChange={handleToggleStrategy}
                            aria-label="Toggle debt payoff strategy"
                          />
                      }
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Avalanche = highest rate first · Snowball = smallest balance first</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Add Debt */}
            <Button
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs font-medium shrink-0"
              onClick={() => { setSelectedDebt(null); setIsFormOpen(true); }}
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Debt
            </Button>
          </div>
        </div>
        {/* Accent line — error red */}
        <div
          className="h-px"
          style={{
            background: 'linear-gradient(to right, transparent 5%, var(--color-border) 20%, color-mix(in oklch, var(--color-error) 45%, var(--color-border)) 50%, var(--color-border) 80%, transparent 95%)',
          }}
        />
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Stats strip ───────────────────────────────────────────────── */}
        {unifiedSummary && (
          <div
            className="rounded-xl px-4 py-3 flex items-center"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            <div className="flex-1 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-error)' }}>Total Debt</div>
              <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-error)' }}>${fmt(unifiedSummary.totalBalance)}</div>
            </div>
            <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />
            <div className="flex-1 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Min/mo</div>
              <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-foreground)' }}>${fmt(unifiedSummary.totalMinimumPayment)}</div>
            </div>
            <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />
            <div className="flex-1 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Strategy</div>
              <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-foreground)' }}>
                <span style={{ color: 'var(--color-success)' }}>{unifiedSummary.inStrategyCount}</span>
                <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>/{unifiedSummary.totalCount}</span>
              </div>
            </div>
            <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />
            <div className="flex-1 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Sources</div>
              <div className="flex items-center justify-center gap-2 leading-none">
                {unifiedSummary.creditAccountCount > 0 && (
                  <span className="flex items-center gap-0.5 text-sm font-mono" style={{ color: 'var(--color-foreground)' }}>
                    <CreditCard className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />
                    {unifiedSummary.creditAccountCount}
                  </span>
                )}
                {(unifiedSummary.debtBillCount + unifiedSummary.standaloneDebtCount) > 0 && (
                  <span className="flex items-center gap-0.5 text-sm font-mono" style={{ color: 'var(--color-foreground)' }}>
                    <FileText className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />
                    {unifiedSummary.debtBillCount + unifiedSummary.standaloneDebtCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Debt-Free Countdown ───────────────────────────────────────── */}
        {hasDebts && (
          <DebtFreeCountdown
            key={`countdown-${refreshKey}`}
            strategyEnabled={debtSettings?.debtStrategyEnabled ?? false}
            payoffMethod={debtSettings?.preferredMethod ?? 'avalanche'}
          />
        )}

        {/* ── Type filter ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { key: 'all',            label: 'All',               icon: Layers },
            { key: 'credit',         label: 'Credit Cards',       icon: CreditCard },
            { key: 'line_of_credit', label: 'Lines of Credit',    icon: Wallet },
            { key: 'loans',          label: 'Loans',              icon: FileText },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setUnifiedFilter(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
              style={{
                backgroundColor: unifiedFilter === key ? 'var(--color-primary)' : 'var(--color-elevated)',
                color: unifiedFilter === key ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                border: `1px solid ${unifiedFilter === key ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Debts list ────────────────────────────────────────────────── */}
        {unifiedLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        ) : unifiedDebts.length === 0 ? (
          <div className="rounded-xl py-14 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--color-muted-foreground)' }}>
              {unifiedFilter === 'all'
                ? "No debts tracked — you're debt-free!"
                : `No ${unifiedFilter === 'credit' ? 'credit cards' : unifiedFilter === 'line_of_credit' ? 'lines of credit' : 'loans'} found.`}
            </p>
            {unifiedFilter === 'all' && (
              <Button
                size="sm"
                onClick={() => setIsFormOpen(true)}
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
              >
                Add a Debt to Track
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Expand/Collapse All */}
            {unifiedDebts.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAllExpanded(true)}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: 'var(--color-background)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-foreground)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)')}
                >
                  <ChevronDown className="w-3.5 h-3.5" /> Expand All
                </button>
                <button
                  onClick={() => setAllExpanded(false)}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)', backgroundColor: 'var(--color-background)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-foreground)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)')}
                >
                  <ChevronUp className="w-3.5 h-3.5" /> Collapse All
                </button>
                <span className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                  {unifiedDebts.length} {unifiedDebts.length === 1 ? 'debt' : 'debts'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {unifiedDebts.map(debt => {
                const currentMethod = debtSettings?.preferredMethod || 'avalanche';
                const rolldown = strategyData?.[currentMethod]?.rolldownPayments?.find(
                  (r: { debtId: string }) => r.debtId === debt.id,
                );
                const payoffTimeline = rolldown ? {
                  strategyMonths: rolldown.payoffMonth ?? 0,
                  strategyDate: rolldown.payoffDate ?? '',
                  minimumOnlyMonths: rolldown.minimumOnlyMonths ?? 0,
                  order: rolldown.order ?? 0,
                  method: currentMethod,
                } : undefined;

                return (
                  <UnifiedDebtCard
                    key={`${debt.source}-${debt.id}`}
                    debt={debt}
                    defaultExpanded={false}
                    expandState={allExpanded}
                    payoffTimeline={payoffTimeline}
                    onEdit={debt.source === 'debt' ? d => handleEditDebt({ id: d.id }) : undefined}
                    onDelete={debt.source === 'debt' ? debtId => handleDeleteDebt(debtId) : undefined}
                    onPayment={debt.source === 'debt' ? () => handlePayment() : undefined}
                    onToggleStrategy={debt.source !== 'debt'
                      ? async (debtId, include) => {
                          try {
                            const res = await postWithHousehold('/api/debts/strategy-toggle', {
                              source: debt.source, id: debtId, include,
                            });
                            if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
                            setUnifiedDebts(prev => prev.map(d => d.id === debtId ? { ...d, includeInPayoffStrategy: include } : d));
                            if (unifiedSummary) {
                              setUnifiedSummary({ ...unifiedSummary, inStrategyCount: unifiedSummary.inStrategyCount + (include ? 1 : -1) });
                            }
                            toast.success(include ? `${debt.name} added to strategy` : `${debt.name} excluded`);
                            triggerRefresh();
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Failed to update strategy');
                          }
                        }
                      : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ── Analytics sections ────────────────────────────────────────── */}
        {hasDebts && (
          <div className="space-y-2">
            {/* Payoff Strategy */}
            {debtSettings && (
              <AnalyticsRow
                icon={Target}
                label="Payoff Strategy"
                description="Snowball vs Avalanche · payoff timeline"
                accentColor="var(--color-primary)"
                open={showStrategy}
                onToggle={() => setShowStrategy(v => !v)}
              >
                <div className="p-4">
                  <DebtPayoffStrategy key={`strategy-${refreshKey}`} />
                </div>
              </AnalyticsRow>
            )}

            {/* Payment Tracking */}
            <AnalyticsRow
              icon={BarChart3}
              label="Payment Tracking"
              description="Adherence · streaks"
              accentColor="var(--color-income)"
              open={showPaymentTracking}
              onToggle={() => setShowPaymentTracking(v => !v)}
            >
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <PaymentAdherenceCard key={`adherence-${refreshKey}`} />
                <PaymentStreakWidget key={`streak-${refreshKey}`} />
              </div>
            </AnalyticsRow>

            {/* Charts (credit only) */}
            {unifiedSummary && unifiedSummary.creditAccountCount > 0 && (
              <AnalyticsRow
                icon={TrendingUp}
                label="Utilization & Balance Trends"
                description="Track credit usage over time"
                accentColor="var(--color-primary)"
                open={showCharts}
                onToggle={() => setShowCharts(v => !v)}
              >
                <div className="p-4 space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <UtilizationTrendsChart key={`utilization-${refreshKey}`} />
                    <BalanceHistoryChart key={`balance-${refreshKey}`} />
                  </div>
                  <InterestPaidChart key={`interest-${refreshKey}`} />
                </div>
              </AnalyticsRow>
            )}

            {/* What-If Calculator */}
            {debtSettings && (
              <AnalyticsRow
                icon={Lightbulb}
                label="What-If Calculator"
                description="Test extra payments · lump sums"
                accentColor="var(--color-warning)"
                open={showWhatIf}
                onToggle={() => setShowWhatIf(v => !v)}
              >
                <div className="p-4">
                  <WhatIfCalculator
                    key={`whatif-${refreshKey}`}
                    currentExtraPayment={debtSettings.extraMonthlyPayment || 0}
                    currentMethod={debtSettings.preferredMethod || 'avalanche'}
                    currentFrequency={debtSettings.paymentFrequency || 'monthly'}
                  />
                </div>
              </AnalyticsRow>
            )}

            {/* Minimum Payment Warning */}
            {debtSettings && (
              <AnalyticsRow
                icon={AlertTriangle}
                label="Minimum Payment Warning"
                description="True cost of paying minimums only"
                accentColor="var(--color-error)"
                open={showMinWarning}
                onToggle={() => setShowMinWarning(v => !v)}
              >
                <div className="p-4">
                  <MinimumPaymentWarning key={`minwarning-${refreshKey}`} />
                </div>
              </AnalyticsRow>
            )}
          </div>
        )}
      </main>

      {/* ── Debt form dialog ──────────────────────────────────────────────── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent
          className="flex flex-col"
          style={{
            color: 'var(--color-foreground)',
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            borderRadius: '1rem',
            maxWidth: '28rem',
            maxHeight: '90vh',
            boxShadow: '0 24px 64px -12px color-mix(in oklch, var(--color-foreground) 18%, transparent)',
          }}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>
              {selectedDebt ? 'Edit Debt' : 'Add New Debt'}
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              {selectedDebt ? 'Update your debt information.' : 'Add a new debt to track and manage.'}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            <DebtForm
              debt={selectedDebt}
              onSubmit={selectedDebt ? handleUpdateDebt : handleCreateDebt}
              onCancel={() => { setIsFormOpen(false); setSelectedDebt(null); }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
