'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { useReportFilters } from '@/lib/hooks/use-report-filters';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  BarChart,
  PieChart,
  AreaChart,
  TreemapChart,
  HeatmapChart,
} from '@/components/charts';
import { ExportButton } from '@/components/reports/export-button';
import { PaymentBreakdownSection } from '@/components/debts/payment-breakdown-section';
import { DebtReductionChart } from '@/components/debts/debt-reduction-chart';
import { AmortizationScheduleView } from '@/components/debts/amortization-schedule-view';
import {
  ChevronDown,
  ChevronUp,
  BarChart3,
  TrendingDown,
  TrendingUp,
  ArrowLeft,
  SlidersHorizontal,
  X,
  RefreshCw,
} from 'lucide-react';
import { FeatureGate } from '@/components/experimental/feature-gate';
import type { PayoffStrategyResult } from '@/lib/debts/payoff-calculator';

type Period = 'month' | 'year' | '12months';
type ChartDataPoint = { name: string; [key: string]: string | number };
type PieDataPoint = { name: string; value: number; [key: string]: string | number };

interface ReportData {
  incomeVsExpenses: { data?: Array<Record<string, unknown>> } & Record<string, unknown>;
  categoryBreakdown: { data?: Array<{ name?: string; value?: number; amount?: number; count?: number; categoryId?: string }> } & Record<string, unknown>;
  cashFlow: { data?: Array<Record<string, unknown>> } & Record<string, unknown>;
  netWorth: {
    history?: Array<Record<string, unknown>>;
    accountBreakdown?: Array<{ name?: string; balance?: number; type?: string; color?: string }>;
    currentNetWorth?: number;
  } & Record<string, unknown>;
  budgetVsActual: Record<string, unknown>;
  merchantAnalysis: { data?: Array<{ name?: string; count?: number; amount?: number; percentageOfTotal?: number }> } & Record<string, unknown>;
}

const COLOR_PALETTE = {
  income:   'var(--color-income)',
  expense:  'var(--color-expense)',
  transfer: 'var(--color-transfer)',
  warning:  'var(--color-warning)',
  primary:  'var(--color-primary)',
};

const PERIOD_LABELS: Record<string, string> = {
  month:     'This Month',
  year:      'This Year',
  '12months': 'Last 12 Months',
};

// Compact section wrapper used around each chart
function ChartSection({
  label,
  accentColor = 'var(--color-primary)',
  children,
}: {
  label: string;
  accentColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)', borderLeft: `3px solid ${accentColor}` }}
    >
      <div
        className="px-4 py-2.5"
        style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: accentColor }}>{label}</span>
      </div>
      <div className="p-1">
        {children}
      </div>
    </div>
  );
}

// Analytics row for debt section
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
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `color-mix(in oklch, ${accentColor} 14%, transparent)` }}>
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

function fmt(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function ReportsPage() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();

  const {
    startDate,
    endDate,
    period,
    setDateRange,
    setPeriod,
    selectedAccountIds,
    selectedCategoryIds,
    selectedMerchantIds,
    setAccountIds,
    setCategoryIds,
    setMerchantIds,
    clearAllFilters,
    getFilterParams,
  } = useReportFilters();

  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentBreakdown, setShowPaymentBreakdown] = useState(false);
  const [showDebtReduction, setShowDebtReduction] = useState(false);
  const [showAmortization, setShowAmortization] = useState(false);
  const [payoffStrategy, setPayoffStrategy] = useState<unknown>(null);

  // Filter data
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [merchants, setMerchants] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showCustomDates, setShowCustomDates] = useState(false);

  const activeFilterCount =
    selectedAccountIds.length + selectedCategoryIds.length + selectedMerchantIds.length;

  const isCustomPeriod = !period && (startDate || endDate);

  const loadPayoffStrategy = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      const settingsRes = await fetchWithHousehold('/api/debts/settings');
      const settings = settingsRes.ok ? await settingsRes.json() : null;
      const extra = settings?.extraMonthlyPayment || 0;
      const method = settings?.preferredMethod || 'avalanche';
      const frequency = settings?.paymentFrequency || 'monthly';
      const res = await fetchWithHousehold(`/api/debts/payoff-strategy?extraPayment=${extra}&method=${method}&paymentFrequency=${frequency}`);
      if (res.ok) setPayoffStrategy(await res.json());
    } catch { setPayoffStrategy(null); }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    const fetchFilterData = async () => {
      if (!selectedHouseholdId) return;
      setIsLoadingFilters(true);
      try {
        const [ar, cr, mr] = await Promise.all([
          fetchWithHousehold('/api/accounts'),
          fetchWithHousehold('/api/categories'),
          fetchWithHousehold('/api/merchants'),
        ]);
        setAccounts(ar.ok ? ((await ar.json()).data || []) : []);
        setCategories(cr.ok ? ((await cr.json()).data || []) : []);
        const md = mr.ok ? await mr.json() : [];
        setMerchants(Array.isArray(md) ? md : (md.data || []));
      } catch { setAccounts([]); setCategories([]); setMerchants([]); }
      finally { setIsLoadingFilters(false); }
    };
    if (selectedHouseholdId) fetchFilterData();
  }, [selectedHouseholdId, fetchWithHousehold]);

  const fetchReports = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      setIsLoading(true);
      setError(null);
      const filterParams = getFilterParams();
      const qs = filterParams.toString();

      if (startDate && endDate) {
        const s = new Date(startDate), e = new Date(endDate);
        if (s > e) { setError('Start date must be before end date'); setIsLoading(false); return; }
        const days = Math.ceil((e.getTime() - s.getTime()) / 86_400_000);
        if (days > 1825) { setError('Date range cannot exceed 5 years'); setIsLoading(false); return; }
      }

      const responses = await Promise.all([
        fetchWithHousehold(`/api/reports/income-vs-expenses?${qs}`),
        fetchWithHousehold(`/api/reports/category-breakdown?${qs}`),
        fetchWithHousehold(`/api/reports/cash-flow?${qs}`),
        fetchWithHousehold(`/api/reports/net-worth?${qs}`),
        fetchWithHousehold(`/api/reports/budget-vs-actual?${qs}`),
        fetchWithHousehold(`/api/reports/merchant-analysis?${qs}`),
      ]);

      const errors: string[] = [];
      for (let i = 0; i < responses.length; i++) {
        if (!responses[i].ok) {
          try { const d = await responses[i].json(); errors.push(d.error || `Report ${i + 1} failed`); }
          catch { errors.push(`Report ${i + 1} failed`); }
        }
      }
      if (errors.length > 0) { setError(errors.join(', ')); setIsLoading(false); return; }

      const [ivE, cb, cf, nw, bva, ma] = await Promise.all(responses.map(r => r.json()));

      const transformData = (raw: unknown, currentPeriod: Period | null) => {
        if (!Array.isArray(raw)) return [];
        const xKey = currentPeriod === 'month' ? 'week' : 'month';
        return raw.map(item => {
          const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          const name = typeof obj[xKey] === 'string' ? obj[xKey] as string : typeof obj.name === 'string' ? obj.name : '';
          return { name, ...obj };
        });
      };

      const cur = (period || '12months') as Period;
      setData({
        incomeVsExpenses: { ...ivE, data: transformData(ivE?.data, cur) },
        categoryBreakdown: cb,
        cashFlow: { ...cf, data: transformData(cf?.data, cur) },
        netWorth: { ...nw, history: transformData(nw?.history, cur) },
        budgetVsActual: bva,
        merchantAnalysis: ma,
      });
    } catch (err) {
      setError(err instanceof Error ? `${err.message}. Please try again.` : 'Failed to load reports.');
    } finally { setIsLoading(false); }
  }, [selectedHouseholdId, period, startDate, endDate, getFilterParams, fetchWithHousehold]);

  useEffect(() => {
    if (!selectedHouseholdId) return;
    fetchReports();
    loadPayoffStrategy();
  }, [selectedHouseholdId, fetchReports, loadPayoffStrategy]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalIncome = data?.incomeVsExpenses?.data?.reduce(
    (s, i) => s + (typeof (i as Record<string, unknown>).income === 'number' ? (i as Record<string, unknown>).income as number : 0), 0) ?? 0;
  const totalExpenses = data?.incomeVsExpenses?.data?.reduce(
    (s, i) => s + (typeof (i as Record<string, unknown>).expenses === 'number' ? (i as Record<string, unknown>).expenses as number : 0), 0) ?? 0;
  const netCashFlow = data?.incomeVsExpenses?.data?.reduce(
    (s, i) => s + (typeof (i as Record<string, unknown>).net === 'number' ? (i as Record<string, unknown>).net as number : 0), 0) ?? 0;
  const netWorthValue = data?.netWorth?.currentNetWorth ?? 0;

  const hasDebtData = (() => {
    const p = payoffStrategy as { schedules?: unknown[] } | null;
    return !!(p?.schedules && p.schedules.length > 0);
  })();

  // Toggle a filter item
  const toggleFilter = (ids: string[], id: string, setter: (ids: string[]) => void) => {
    const s = new Set(ids);
    s.has(id) ? s.delete(id) : s.add(id);
    setter(Array.from(s));
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <div style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="w-24 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20 h-8 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="w-20 h-8 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="w-20 h-8 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          <div className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)' }} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-72 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="text-center">
          <p className="font-medium mb-1" style={{ color: 'var(--color-error)' }}>Failed to load reports</p>
          <p className="text-sm mb-5" style={{ color: 'var(--color-muted-foreground)' }}>{error || 'Unknown error'}</p>
          <Button size="sm" onClick={fetchReports} style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50">
        <div
          className="backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 flex-wrap">
            {/* Back */}
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>

            <h1 className="text-lg font-semibold tracking-tight mr-2 shrink-0" style={{ color: 'var(--color-foreground)' }}>
              Reports
            </h1>

            {/* Period pills */}
            <div
              className="flex rounded-lg overflow-hidden shrink-0"
              style={{ border: '1px solid var(--color-border)' }}
            >
              {(['month', 'year', '12months'] as const).map((p, i) => (
                <button
                  key={p}
                  onClick={() => { setPeriod(p); setShowCustomDates(false); }}
                  className="px-2.5 py-1 text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: period === p && !isCustomPeriod ? 'var(--color-primary)' : 'transparent',
                    color: period === p && !isCustomPeriod ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                    borderLeft: i > 0 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  {p === 'month' ? 'Month' : p === 'year' ? 'Year' : '12 Months'}
                </button>
              ))}
              <button
                onClick={() => setShowCustomDates(v => !v)}
                className="px-2.5 py-1 text-[11px] font-medium transition-colors"
                style={{
                  backgroundColor: isCustomPeriod || showCustomDates ? 'var(--color-primary)' : 'transparent',
                  color: isCustomPeriod || showCustomDates ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                  borderLeft: '1px solid var(--color-border)',
                }}
              >
                {isCustomPeriod && startDate && endDate
                  ? `${startDate.slice(5)} – ${endDate.slice(5)}`
                  : 'Custom'}
              </button>
            </div>

            {/* Filter toggle */}
            {!isLoadingFilters && (
              <button
                onClick={() => setShowFilters(v => !v)}
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-medium transition-colors shrink-0"
                style={{
                  border: `1px solid ${showFilters || activeFilterCount > 0 ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  backgroundColor: showFilters ? 'color-mix(in oklch, var(--color-primary) 10%, transparent)' : 'transparent',
                  color: showFilters || activeFilterCount > 0 ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                }}
              >
                <SlidersHorizontal className="w-3 h-3" />
                Filters
                {activeFilterCount > 0 && (
                  <span
                    className="text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={fetchReports}
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)' }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-foreground)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)')}
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <div className="flex-1" />

            {/* Export */}
            <ExportButton
              data={data}
              reportName="Financial_Report"
              summary={{ period: period || 'custom', generated: new Date().toLocaleDateString() }}
            />
          </div>

          {/* Custom date inputs (shown inline below pill row) */}
          {showCustomDates && (
            <div
              className="max-w-5xl mx-auto px-4 sm:px-6 pb-3 flex items-center gap-3 flex-wrap"
              style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}
            >
              <span className="text-[11px] font-medium shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>From</span>
              <input
                type="date"
                value={startDate || ''}
                onChange={e => setDateRange(e.target.value || null, endDate)}
                className="h-7 px-2 rounded-lg text-[12px] font-mono outline-none"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-elevated)',
                  color: 'var(--color-foreground)',
                }}
              />
              <span className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>→</span>
              <input
                type="date"
                value={endDate || ''}
                onChange={e => setDateRange(startDate, e.target.value || null)}
                className="h-7 px-2 rounded-lg text-[12px] font-mono outline-none"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-elevated)',
                  color: 'var(--color-foreground)',
                }}
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => { setDateRange(null, null); setShowCustomDates(false); }}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          )}

          {/* Compact filter panel */}
          {showFilters && !isLoadingFilters && (
            <div
              className="max-w-5xl mx-auto px-4 sm:px-6 pb-3 space-y-2.5"
              style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)', paddingTop: '0.75rem' }}
            >
              {/* Accounts */}
              {accounts.length > 0 && (
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-widest w-20 shrink-0 mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Accounts</span>
                  <div className="flex gap-1.5 flex-wrap flex-1">
                    {accounts.map(a => (
                      <button
                        key={a.id}
                        onClick={() => toggleFilter(selectedAccountIds, a.id, setAccountIds)}
                        className="text-[11px] px-2 py-0.5 rounded-full transition-colors"
                        style={{
                          backgroundColor: selectedAccountIds.includes(a.id) ? 'var(--color-primary)' : 'var(--color-elevated)',
                          color: selectedAccountIds.includes(a.id) ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                          border: `1px solid ${selectedAccountIds.includes(a.id) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        }}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              {categories.length > 0 && (
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-widest w-20 shrink-0 mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Categories</span>
                  <div className="flex gap-1.5 flex-wrap flex-1">
                    {categories.map(c => (
                      <button
                        key={c.id}
                        onClick={() => toggleFilter(selectedCategoryIds, c.id, setCategoryIds)}
                        className="text-[11px] px-2 py-0.5 rounded-full transition-colors"
                        style={{
                          backgroundColor: selectedCategoryIds.includes(c.id) ? 'var(--color-primary)' : 'var(--color-elevated)',
                          color: selectedCategoryIds.includes(c.id) ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                          border: `1px solid ${selectedCategoryIds.includes(c.id) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Merchants */}
              {merchants.length > 0 && (
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-widest w-20 shrink-0 mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Merchants</span>
                  <div className="flex gap-1.5 flex-wrap flex-1">
                    {merchants.slice(0, 20).map(m => (
                      <button
                        key={m.id}
                        onClick={() => toggleFilter(selectedMerchantIds, m.id, setMerchantIds)}
                        className="text-[11px] px-2 py-0.5 rounded-full transition-colors"
                        style={{
                          backgroundColor: selectedMerchantIds.includes(m.id) ? 'var(--color-primary)' : 'var(--color-elevated)',
                          color: selectedMerchantIds.includes(m.id) ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                          border: `1px solid ${selectedMerchantIds.includes(m.id) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        }}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear */}
              {activeFilterCount > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={clearAllFilters}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg transition-colors"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-foreground)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)')}
                  >
                    <X className="w-3 h-3" /> Clear all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Accent line */}
        <div
          className="h-px"
          style={{
            background: 'linear-gradient(to right, transparent 5%, var(--color-border) 20%, color-mix(in oklch, var(--color-primary) 45%, var(--color-border)) 50%, var(--color-border) 80%, transparent 95%)',
          }}
        />
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Active period label ───────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
            {isCustomPeriod && startDate && endDate
              ? `${startDate} – ${endDate}`
              : PERIOD_LABELS[period || '12months']}
          </span>
          {activeFilterCount > 0 && (
            <span className="text-[10px] px-1.5 py-px rounded" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }}>
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
            </span>
          )}
        </div>

        {/* ── Stats strip ───────────────────────────────────────────────────── */}
        <div
          className="rounded-xl px-4 py-3 flex items-center"
          style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
        >
          <div className="flex-1 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-income)' }}>Income</div>
            <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-income)' }}>{fmt(totalIncome)}</div>
          </div>
          <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />
          <div className="flex-1 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-expense)' }}>Expenses</div>
            <div className="text-lg font-bold font-mono tabular-nums leading-none" style={{ color: 'var(--color-expense)' }}>{fmt(totalExpenses)}</div>
          </div>
          <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />
          <div className="flex-1 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Cash Flow</div>
            <div
              className="text-lg font-bold font-mono tabular-nums leading-none"
              style={{ color: netCashFlow >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}
            >
              {fmt(netCashFlow)}
            </div>
          </div>
          <div className="w-px h-8 self-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />
          <div className="flex-1 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Net Worth</div>
            <div
              className="text-lg font-bold font-mono tabular-nums leading-none"
              style={{ color: netWorthValue >= 0 ? 'var(--color-income)' : 'var(--color-expense)' }}
            >
              {fmt(netWorthValue)}
            </div>
          </div>
        </div>

        {/* ── Main charts grid ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSection label="Income vs Expenses" accentColor="var(--color-income)">
            <LineChart
              title=""
              description=""
              data={(data.incomeVsExpenses?.data || []) as unknown as ChartDataPoint[]}
              lines={[
                { dataKey: 'income',   stroke: COLOR_PALETTE.income,  name: 'Income' },
                { dataKey: 'expenses', stroke: COLOR_PALETTE.expense, name: 'Expenses' },
              ]}
            />
          </ChartSection>

          <ChartSection label="Spending by Category" accentColor="var(--color-expense)">
            <PieChart
              title=""
              description=""
              data={(data.categoryBreakdown?.data || []) as unknown as PieDataPoint[]}
              colors={[
                COLOR_PALETTE.primary, COLOR_PALETTE.income, COLOR_PALETTE.expense,
                COLOR_PALETTE.transfer, COLOR_PALETTE.warning, '#8b5cf6', '#ec4899', '#14b8a6',
              ]}
            />
          </ChartSection>

          <ChartSection label="Cash Flow Analysis" accentColor="var(--color-primary)">
            <AreaChart
              title=""
              description=""
              data={(data.cashFlow?.data || []) as unknown as ChartDataPoint[]}
              areas={[
                { dataKey: 'inflows',  fill: COLOR_PALETTE.income,  stroke: COLOR_PALETTE.income,  name: 'Inflows' },
                { dataKey: 'outflows', fill: COLOR_PALETTE.expense, stroke: COLOR_PALETTE.expense, name: 'Outflows' },
              ]}
            />
          </ChartSection>

          <ChartSection label="Net Worth Trend" accentColor="var(--color-primary)">
            <LineChart
              title=""
              description=""
              data={(data.netWorth?.history || []) as unknown as ChartDataPoint[]}
              lines={[{ dataKey: 'netWorth', stroke: COLOR_PALETTE.primary, name: 'Net Worth' }]}
              xAxisLabel={period === 'month' ? 'Week' : 'Month'}
              yAxisLabel="Amount ($)"
            />
          </ChartSection>

          {/* Experimental charts */}
          <FeatureGate featureId="advanced-charts">
            <ChartSection label="Category Treemap" accentColor="var(--color-warning)">
              <TreemapChart
                title=""
                description=""
                data={(data.categoryBreakdown?.data || []).map(item => ({
                  name: item.name || '',
                  value: item.value ?? 0,
                  color: COLOR_PALETTE.expense,
                }))}
              />
            </ChartSection>
          </FeatureGate>

          <FeatureGate featureId="advanced-charts">
            <ChartSection label="Spending Heatmap" accentColor="var(--color-warning)">
              <HeatmapChart
                title=""
                description=""
                data={(() => {
                  const cats = data.categoryBreakdown?.data || [];
                  const months = (data.incomeVsExpenses?.data || []).map(d => typeof d.name === 'string' ? d.name : '');
                  type HeatmapCell = { category: string; month: string; value: number };
                  const heatmapData: HeatmapCell[] = [];
                  cats.forEach(cat => {
                    months.forEach(month => {
                      heatmapData.push({ category: cat.name || '', month, value: Math.random() * (cat.value ?? 0) });
                    });
                  });
                  return heatmapData;
                })()}
              />
            </ChartSection>
          </FeatureGate>
        </div>

        {/* ── Budget vs Actual ──────────────────────────────────────────────── */}
        <ChartSection label="Budget vs Actual" accentColor="var(--color-primary)">
          <BarChart
            title=""
            description=""
            data={(((data.budgetVsActual as unknown as { data?: unknown })?.data || []) as unknown) as ChartDataPoint[]}
            bars={[
              { dataKey: 'budget', fill: COLOR_PALETTE.primary, name: 'Budget' },
              { dataKey: 'actual', fill: COLOR_PALETTE.expense,  name: 'Actual' },
            ]}
            layout="vertical"
          />
        </ChartSection>

        {/* ── Account breakdown + top merchants ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Account breakdown */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)', borderLeft: '3px solid var(--color-primary)' }}
          >
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}>
              <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-primary)' }}>Account Breakdown</span>
            </div>
            <div className="px-4 py-3 divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
              {(data.netWorth?.accountBreakdown || []).map(account => (
                <div key={account.name} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: account.color || 'var(--color-primary)' }} />
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>{account.name}</p>
                      <p className="text-[10px] capitalize" style={{ color: 'var(--color-muted-foreground)' }}>{account.type}</p>
                    </div>
                  </div>
                  <p className="text-[13px] font-mono font-semibold tabular-nums" style={{ color: 'var(--color-foreground)' }}>
                    ${(account.balance ?? 0).toFixed(2)}
                  </p>
                </div>
              ))}
              {(data.netWorth?.accountBreakdown || []).length === 0 && (
                <p className="py-6 text-center text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>No accounts</p>
              )}
            </div>
          </div>

          {/* Top merchants */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)', borderLeft: '3px solid var(--color-expense)' }}
          >
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}>
              <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-expense)' }}>Top Merchants</span>
            </div>
            <div className="px-4 py-3 space-y-0">
              {(data.merchantAnalysis?.data || []).slice(0, 6).map((m, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: idx < 5 ? '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' : 'none' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono w-4 text-right shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: 'var(--color-foreground)' }}>{m.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>{m.count ?? 0} txns</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-[13px] font-mono font-semibold tabular-nums" style={{ color: 'var(--color-expense)' }}>
                      ${(m.amount ?? 0).toFixed(0)}
                    </p>
                    <p className="text-[10px] font-mono" style={{ color: 'var(--color-muted-foreground)' }}>
                      {(m.percentageOfTotal ?? 0).toFixed(0)}%
                    </p>
                  </div>
                </div>
              ))}
              {(data.merchantAnalysis?.data || []).length === 0 && (
                <p className="py-6 text-center text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>No merchant data</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Merchant distribution chart ───────────────────────────────────── */}
        {(data.merchantAnalysis?.data || []).length > 0 && (
          <ChartSection label="Merchant Distribution" accentColor="var(--color-expense)">
            <BarChart
              title=""
              description=""
              data={(data.merchantAnalysis?.data?.slice(0, 10) || []) as unknown as ChartDataPoint[]}
              bars={[{ dataKey: 'amount', fill: COLOR_PALETTE.expense, name: 'Amount' }]}
              layout="vertical"
            />
          </ChartSection>
        )}

        {/* ── Debt Analysis ─────────────────────────────────────────────────── */}
        {hasDebtData && (
          <div className="space-y-2 pt-2">
            <div
              className="flex items-center gap-3 pb-2"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>Debt Analysis</span>
            </div>

            <AnalyticsRow
              icon={BarChart3}
              label="Payment Breakdown"
              description="Principal vs Interest cost visualization"
              accentColor="var(--color-primary)"
              open={showPaymentBreakdown}
              onToggle={() => setShowPaymentBreakdown(v => !v)}
            >
              <div className="p-4">
                <PaymentBreakdownSection strategy={payoffStrategy as unknown as PayoffStrategyResult} />
              </div>
            </AnalyticsRow>

            <AnalyticsRow
              icon={TrendingDown}
              label="Debt Reduction Progress"
              description="Historical progress and future projections"
              accentColor="var(--color-income)"
              open={showDebtReduction}
              onToggle={() => setShowDebtReduction(v => !v)}
            >
              <div className="p-4">
                <DebtReductionChart />
              </div>
            </AnalyticsRow>

            <AnalyticsRow
              icon={TrendingUp}
              label="Amortization Schedule"
              description="Month-by-month payment breakdowns"
              accentColor="var(--color-primary)"
              open={showAmortization}
              onToggle={() => setShowAmortization(v => !v)}
            >
              <div className="p-4">
                <AmortizationScheduleView strategy={payoffStrategy as unknown as PayoffStrategyResult} />
              </div>
            </AnalyticsRow>
          </div>
        )}
      </main>
    </div>
  );
}
