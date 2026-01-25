'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { Plus, ChevronDown, ChevronUp, Target, BarChart3, Lightbulb, AlertTriangle, CreditCard, Wallet, FileText, Layers, TrendingUp, Info, Loader2, Settings } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Link from 'next/link';
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

export default function DebtsPage() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold, putWithHousehold, deleteWithHousehold } = useHouseholdFetch();
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
  // Refresh key forces child components to remount and re-fetch their data
  const [refreshKey, setRefreshKey] = useState(0);
  // Track strategy toggle saving state
  const [savingStrategy, setSavingStrategy] = useState(false);
  // Strategy data for payoff timelines on individual debt cards
  const [strategyData, setStrategyData] = useState<StrategyData | null>(null);
  // Unified debts state
  const [unifiedDebts, setUnifiedDebts] = useState<UnifiedDebt[]>([]);
  const [unifiedSummary, setUnifiedSummary] = useState<UnifiedDebtSummary | null>(null);
  const [unifiedLoading, setUnifiedLoading] = useState(true);
  const [unifiedFilter, setUnifiedFilter] = useState<'all' | 'credit' | 'line_of_credit' | 'loans'>('all');

  const triggerRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // Load unified debts (credit accounts + debt bills)
  const loadUnifiedDebts = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      setUnifiedLoading(true);
      // Build query params based on filter
      const params = new URLSearchParams();
      if (unifiedFilter === 'credit') {
        params.set('type', 'credit');
      } else if (unifiedFilter === 'line_of_credit') {
        params.set('type', 'line_of_credit');
      } else if (unifiedFilter === 'loans') {
        params.set('source', 'bill');
      }
      
      const queryString = params.toString();
      const url = `/api/debts/unified${queryString ? `?${queryString}` : ''}`;
      const response = await fetchWithHousehold(url);
      
      if (response.ok) {
        const data = await response.json();
        setUnifiedDebts(data.debts);
        setUnifiedSummary(data.summary);
      }
    } catch (error) {
      console.error('Error loading unified debts:', error);
    } finally {
      setUnifiedLoading(false);
    }
  }, [selectedHouseholdId, unifiedFilter, fetchWithHousehold]);

  const loadSettings = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      const response = await fetchWithHousehold('/api/debts/settings');
      if (response.ok) {
        const data = (await response.json()) as DebtSettings;
        setDebtSettings(data);
      }
    } catch (error) {
      console.error('Error loading debt settings:', error);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  const loadStats = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      const response = await fetchWithHousehold('/api/debts/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = (await response.json()) as DebtStats;
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  const loadStrategyData = useCallback(async () => {
    if (!selectedHouseholdId || !debtSettings) return;
    try {
      const extraPayment = debtSettings.extraMonthlyPayment || 0;
      const response = await fetchWithHousehold(`/api/debts/payoff-strategy?compare=true&extraPayment=${extraPayment}`);
      if (response.ok) {
        const data = (await response.json()) as StrategyData;
        setStrategyData(data);
      }
    } catch (error) {
      console.error('Error loading strategy data:', error);
    }
  }, [selectedHouseholdId, debtSettings, fetchWithHousehold]);

  // Fetch debts and settings
  useEffect(() => {
    if (!selectedHouseholdId) return;
    loadStats();
    loadSettings();
    loadUnifiedDebts();
  }, [selectedHouseholdId, loadStats, loadSettings, loadUnifiedDebts]);

  // Reload unified debts when filter changes
  useEffect(() => {
    loadUnifiedDebts();
  }, [unifiedFilter, loadUnifiedDebts, refreshKey]);

  // Load strategy data when settings are available
  useEffect(() => {
    if (debtSettings) {
      loadStrategyData();
    }
  }, [debtSettings, loadStrategyData, refreshKey]);

  const loadDebtDetails = async (debtId: string) => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return null;
    }
    try {
      const response = await fetchWithHousehold(`/api/debts/${debtId}`);
      if (!response.ok) throw new Error('Failed to fetch debt');
      return await response.json();
    } catch (_error) {
      toast.error('Failed to load debt details');
      return null;
    }
  };

  const handleCreateDebt = async (data: Record<string, unknown>, saveMode: 'save' | 'saveAndAdd' = 'save') => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return;
    }
    try {
      const response = await postWithHousehold('/api/debts', data);

      if (!response.ok) throw new Error('Failed to create debt');

      // Show appropriate toast message
      if (saveMode === 'saveAndAdd') {
        const debtName = typeof data.name === 'string' ? data.name : 'Debt';
        toast.success(`Debt "${debtName}" saved successfully!`);
        // Keep dialog open for adding another debt
      } else {
        toast.success('Debt added successfully!');
        setIsFormOpen(false);
        setSelectedDebt(null);
      }
      loadStats();
      loadUnifiedDebts();
      triggerRefresh();
    } catch (_error) {
      toast.error('Failed to add debt');
    }
  };

  const handleUpdateDebt = async (data: Record<string, unknown>) => {
    if (!selectedDebt) return;
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return;
    }

    try {
      const response = await putWithHousehold(`/api/debts/${selectedDebt.id}`, data);

      if (!response.ok) throw new Error('Failed to update debt');

      toast.success('Debt updated successfully!');
      setIsFormOpen(false);
      setSelectedDebt(null);
      loadStats();
      loadUnifiedDebts();
      triggerRefresh();
    } catch (_error) {
      toast.error('Failed to update debt');
    }
  };

  const handleDeleteDebt = async (debtId: string) => {
    if (!confirm('Are you sure you want to delete this debt?')) return;
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return;
    }

    try {
      const response = await deleteWithHousehold(`/api/debts/${debtId}`);

      if (!response.ok) throw new Error('Failed to delete debt');

      toast.success('Debt deleted successfully!');
      loadStats();
      loadUnifiedDebts();
      triggerRefresh();
    } catch (_error) {
      toast.error('Failed to delete debt');
    }
  };

  const handleEditDebt = async (debt: { id: string }) => {
    const details = await loadDebtDetails(debt.id);
    if (details) {
      setSelectedDebt(details as Partial<DebtFormData> & { id: string });
      setIsFormOpen(true);
    }
  };

  const handlePayment = () => {
    loadStats();
    loadUnifiedDebts();
    triggerRefresh();
  };

  const handleToggleStrategy = async (enabled: boolean) => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return;
    }
    
    setSavingStrategy(true);
    try {
      const response = await putWithHousehold('/api/debts/settings', {
        ...(debtSettings ?? {}),
        debtStrategyEnabled: enabled,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update strategy');
      }
      
      // Update local state
      setDebtSettings((prev) => ({
        ...(prev ?? {}),
        debtStrategyEnabled: enabled,
      }));
      
      toast.success(enabled 
        ? 'Debt payoff strategy enabled' 
        : 'Debt payoff strategy disabled'
      );
      
      // Refresh related components
      triggerRefresh();
      loadUnifiedDebts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update strategy');
    } finally {
      setSavingStrategy(false);
    }
  };

  if (unifiedLoading && !stats) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading debts...</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header - Compact */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Debt Management</h1>
            <p className="text-muted-foreground text-sm">Track and pay off your debts</p>
          </div>
          <Button
            onClick={() => {
              setSelectedDebt(null);
              setIsFormOpen(true);
            }}
            size="sm"
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Debt
          </Button>
        </div>

        {/* Strategy Toggle - Compact Inline */}
        {stats && stats.activeDebtCount > 0 && debtSettings && (
          <div className="flex items-center justify-between gap-3 bg-card border border-border rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Target className={`w-4 h-4 shrink-0 ${debtSettings.debtStrategyEnabled ? 'text-income' : 'text-muted-foreground'}`} />
              <span className="text-sm font-medium text-foreground truncate">
                {debtSettings.debtStrategyEnabled
                  ? `${debtSettings.preferredMethod === 'avalanche' ? 'Avalanche' : 'Snowball'} Strategy`
                  : 'Strategy Disabled'}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      When enabled, debts are prioritized based on your chosen method (Avalanche = highest rate first, Snowball = smallest balance first).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/dashboard/settings?tab=household-financial"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </Link>
              {savingStrategy ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  checked={debtSettings.debtStrategyEnabled ?? false}
                  onCheckedChange={handleToggleStrategy}
                  aria-label="Toggle debt payoff strategy"
                />
              )}
            </div>
          </div>
        )}

        {/* Summary Stats - Compact with inline layout on larger screens */}
        {unifiedSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-card border border-border rounded-lg px-3 py-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0.5 md:gap-2">
                <span className="text-muted-foreground text-xs">Total Debt</span>
                <span className="text-lg md:text-base font-bold font-mono text-error">
                  ${unifiedSummary.totalBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg px-3 py-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0.5 md:gap-2">
                <span className="text-muted-foreground text-xs">Min Payments</span>
                <span className="text-lg md:text-base font-bold font-mono text-foreground">
                  ${unifiedSummary.totalMinimumPayment.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg px-3 py-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0.5 md:gap-2">
                <span className="text-muted-foreground text-xs">In Strategy</span>
                <span className="text-lg md:text-base font-bold font-mono text-success">
                  {unifiedSummary.inStrategyCount}/{unifiedSummary.totalCount}
                </span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg px-3 py-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-0.5 md:gap-2">
                <span className="text-muted-foreground text-xs">Sources</span>
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{unifiedSummary.creditAccountCount}</span>
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{unifiedSummary.debtBillCount}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debt-Free Countdown */}
        {stats && stats.activeDebtCount > 0 && (
          <DebtFreeCountdown 
            key={`countdown-${refreshKey}`}
            strategyEnabled={debtSettings?.debtStrategyEnabled ?? false}
            payoffMethod={debtSettings?.preferredMethod ?? 'avalanche'}
          />
        )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All', icon: Layers },
          { key: 'credit', label: 'Credit Cards', icon: CreditCard },
          { key: 'line_of_credit', label: 'Lines of Credit', icon: Wallet },
          { key: 'loans', label: 'Loans', icon: FileText },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setUnifiedFilter(key as typeof unifiedFilter)}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
              unifiedFilter === key
                ? 'bg-accent text-accent-foreground'
                : 'bg-card text-muted-foreground border border-border hover:bg-elevated'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Debts List */}
      {unifiedLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading debts...</p>
        </div>
      ) : unifiedDebts.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-lg">
          <p className="text-muted-foreground">
            {unifiedFilter === 'all'
              ? "No debts yet. You're debt-free!"
              : `No ${unifiedFilter === 'credit' ? 'credit cards' : unifiedFilter === 'line_of_credit' ? 'lines of credit' : 'loans'} found.`}
          </p>
          {unifiedFilter === 'all' && (
            <Button
              onClick={() => setIsFormOpen(true)}
              className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              Add a Debt to Track
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Expand/Collapse All Controls */}
          {unifiedDebts.length > 1 && (
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAllExpanded(true)}
                className="text-sm border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
              >
                <ChevronDown className="w-4 h-4 mr-1" />
                Expand All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAllExpanded(false)}
                className="text-sm border-border text-muted-foreground hover:text-foreground hover:bg-elevated"
              >
                <ChevronUp className="w-4 h-4 mr-1" />
                Collapse All
              </Button>
              <span className="text-xs text-muted-foreground ml-2">
                {unifiedDebts.length} {unifiedDebts.length === 1 ? 'debt' : 'debts'}
              </span>
            </div>
          )}

          {/* Debts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unifiedDebts.map((debt) => {
              // Get payoff timeline from strategy data for this debt
              const currentMethod = debtSettings?.preferredMethod || 'avalanche';
              const rolldownPayment = strategyData?.[currentMethod]?.rolldownPayments?.find(
                (r: { debtId: string }) => r.debtId === debt.id
              );
              const payoffTimeline = rolldownPayment ? {
                strategyMonths: rolldownPayment.payoffMonth ?? 0,
                strategyDate: rolldownPayment.payoffDate ?? '',
                minimumOnlyMonths: rolldownPayment.minimumOnlyMonths ?? 0,
                order: rolldownPayment.order ?? 0,
                method: currentMethod,
              } : undefined;

              return (
                <UnifiedDebtCard
                  key={`${debt.source}-${debt.id}`}
                  debt={debt}
                  defaultExpanded={allExpanded ?? false}
                  payoffTimeline={payoffTimeline}
                  onEdit={debt.source === 'debt' ? (d) => handleEditDebt({ id: d.id }) : undefined}
                  onDelete={debt.source === 'debt' ? (debtId) => handleDeleteDebt(debtId) : undefined}
                  onPayment={debt.source === 'debt' ? () => handlePayment() : undefined}
                  onToggleStrategy={async (debtId, include) => {
                    try {
                      const response = await postWithHousehold('/api/debts/strategy-toggle', {
                        source: debt.source,
                        id: debtId,
                        include,
                      });

                      if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || 'Failed to update');
                      }

                      // Update local state optimistically
                      setUnifiedDebts(prev =>
                        prev.map(d =>
                          d.id === debtId
                            ? { ...d, includeInPayoffStrategy: include }
                            : d
                        )
                      );

                      // Update summary counts
                      if (unifiedSummary) {
                        setUnifiedSummary({
                          ...unifiedSummary,
                          inStrategyCount: include
                            ? unifiedSummary.inStrategyCount + 1
                            : unifiedSummary.inStrategyCount - 1,
                        });
                      }

                      toast.success(include
                        ? `${debt.name} added to payoff strategy`
                        : `${debt.name} excluded from payoff strategy`
                      );

                      // Refresh strategy data
                      triggerRefresh();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Failed to update strategy');
                    }
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Payoff Strategy Section */}
      {stats && stats.activeDebtCount > 0 && debtSettings && (
        <div className="space-y-4">
          <button
            onClick={() => setShowStrategy(!showStrategy)}
            className="flex items-center justify-between w-full bg-card border border-border rounded-lg p-4 hover:bg-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6 text-primary" />
              <div className="text-left">
                <h3 className="text-lg font-semibold text-foreground">Debt Payoff Strategy</h3>
                <p className="text-sm text-muted-foreground">
                  Compare Snowball vs Avalanche methods and see your payoff timeline
                </p>
              </div>
            </div>
            {showStrategy ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {showStrategy && <DebtPayoffStrategy key={`strategy-${refreshKey}`} />}
        </div>
      )}

      {/* Payment Tracking Section */}
      {stats && stats.activeDebtCount > 0 && (
        <div className="space-y-4">
          <button
            onClick={() => setShowPaymentTracking(!showPaymentTracking)}
            className="flex items-center justify-between w-full bg-card border border-border rounded-lg p-4 hover:bg-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-primary" />
              <div className="text-left">
                <h3 className="text-lg font-semibold text-foreground">Payment Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  Monitor payment adherence and track your payment streak
                </p>
              </div>
            </div>
            {showPaymentTracking ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {showPaymentTracking && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PaymentAdherenceCard key={`adherence-${refreshKey}`} />
              <PaymentStreakWidget key={`streak-${refreshKey}`} />
            </div>
          )}
        </div>
      )}

      {/* Credit Utilization & Balance Charts Section */}
      {unifiedSummary && unifiedSummary.creditAccountCount > 0 && (
        <div className="space-y-4">
          <button
            onClick={() => setShowCharts(!showCharts)}
            className="flex items-center justify-between w-full bg-card border border-border rounded-lg p-4 hover:bg-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-primary" />
              <div className="text-left">
                <h3 className="text-lg font-semibold text-foreground">Utilization & Balance Trends</h3>
                <p className="text-sm text-muted-foreground">
                  Track how your credit utilization and balances change over time
                </p>
              </div>
            </div>
            {showCharts ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {showCharts && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <UtilizationTrendsChart key={`utilization-${refreshKey}`} />
                <BalanceHistoryChart key={`balance-${refreshKey}`} />
              </div>
              <InterestPaidChart key={`interest-${refreshKey}`} />
            </div>
          )}
        </div>
      )}

      {/* What-If Calculator Section */}
      {stats && stats.activeDebtCount > 0 && debtSettings && (
        <div className="space-y-4">
          <button
            onClick={() => setShowWhatIf(!showWhatIf)}
            className="flex items-center justify-between w-full bg-card border border-border rounded-lg p-4 hover:bg-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <Lightbulb className="w-6 h-6 text-primary" />
              <div className="text-left">
                <h3 className="text-lg font-semibold text-foreground">What-If Scenario Calculator</h3>
                <p className="text-sm text-muted-foreground">
                  Test different payment strategies and see how lump sums affect your timeline
                </p>
              </div>
            </div>
            {showWhatIf ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {showWhatIf && (
            <WhatIfCalculator
              key={`whatif-${refreshKey}`}
              currentExtraPayment={debtSettings.extraMonthlyPayment || 0}
              currentMethod={debtSettings.preferredMethod || 'avalanche'}
              currentFrequency={debtSettings.paymentFrequency || 'monthly'}
            />
          )}
        </div>
      )}

      {/* Minimum Payment Warning Section */}
      {stats && stats.activeDebtCount > 0 && debtSettings && (
        <div className="space-y-4">
          <button
            onClick={() => setShowMinWarning(!showMinWarning)}
            className="flex items-center justify-between w-full bg-card border border-border rounded-lg p-4 hover:bg-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-warning" />
              <div className="text-left">
                <h3 className="text-lg font-semibold text-foreground">Minimum Payment Warning</h3>
                <p className="text-sm text-muted-foreground">
                  See the true cost of paying only minimum payments
                </p>
              </div>
            </div>
            {showMinWarning ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {showMinWarning && <MinimumPaymentWarning key={`minwarning-${refreshKey}`} />}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{selectedDebt ? 'Edit Debt' : 'Add New Debt'}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedDebt
                ? 'Update your debt information'
                : 'Add a new debt to track and manage'}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            <DebtForm
              debt={selectedDebt}
              onSubmit={selectedDebt ? handleUpdateDebt : handleCreateDebt}
              onCancel={() => {
                setIsFormOpen(false);
                setSelectedDebt(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
