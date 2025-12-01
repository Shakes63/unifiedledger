'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { DebtPayoffTracker } from '@/components/debts/debt-payoff-tracker';
import { DebtForm } from '@/components/debts/debt-form';
import { DebtPayoffStrategy } from '@/components/debts/debt-payoff-strategy';
import { WhatIfCalculator } from '@/components/debts/what-if-calculator';
import { MinimumPaymentWarning } from '@/components/debts/minimum-payment-warning';
import { PaymentAdherenceCard } from '@/components/debts/payment-adherence-card';
import { PaymentStreakWidget } from '@/components/debts/payment-streak-widget';
import { DebtFreeCountdown } from '@/components/dashboard/debt-free-countdown';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, ChevronDown, ChevronUp, Target, BarChart3, Lightbulb, AlertTriangle } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

export default function DebtsPage() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, postWithHousehold, putWithHousehold, deleteWithHousehold } = useHouseholdFetch();
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'paid_off'>('active');
  const [stats, setStats] = useState<any>(null);
  const [showMinWarning, setShowMinWarning] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [showPaymentTracking, setShowPaymentTracking] = useState(false);
  const [debtSettings, setDebtSettings] = useState<any>(null);
  const [allExpanded, setAllExpanded] = useState<boolean | null>(null);
  // Refresh key forces child components to remount and re-fetch their data
  const [refreshKey, setRefreshKey] = useState(0);
  // Strategy data for payoff timelines on individual debt cards
  const [strategyData, setStrategyData] = useState<any>(null);

  const triggerRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const loadSettings = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      const response = await fetchWithHousehold('/api/debts/settings');
      if (response.ok) {
        const data = await response.json();
        setDebtSettings(data);
      }
    } catch (error) {
      console.error('Error loading debt settings:', error);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  const loadDebts = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      setLoading(true);
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await fetchWithHousehold(`/api/debts${params}`);
      if (!response.ok) throw new Error('Failed to fetch debts');
      const data = await response.json();
      setDebts(data);
    } catch (error) {
      toast.error('Failed to load debts');
    } finally {
      setLoading(false);
    }
  }, [filter, selectedHouseholdId, fetchWithHousehold]);

  const loadStats = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      const response = await fetchWithHousehold('/api/debts/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
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
        const data = await response.json();
        setStrategyData(data);
      }
    } catch (error) {
      console.error('Error loading strategy data:', error);
    }
  }, [selectedHouseholdId, debtSettings, fetchWithHousehold]);

  // Fetch debts and settings
  useEffect(() => {
    if (!selectedHouseholdId) return;
    loadDebts();
    loadStats();
    loadSettings();
  }, [filter, selectedHouseholdId, loadDebts, loadStats, loadSettings]);

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
    } catch (error) {
      toast.error('Failed to load debt details');
      return null;
    }
  };

  const handleCreateDebt = async (data: any, saveMode: 'save' | 'saveAndAdd' = 'save') => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return;
    }
    try {
      const response = await postWithHousehold('/api/debts', data);

      if (!response.ok) throw new Error('Failed to create debt');

      // Show appropriate toast message
      if (saveMode === 'saveAndAdd') {
        toast.success(`Debt "${data.name}" saved successfully!`);
        // Keep dialog open for adding another debt
      } else {
        toast.success('Debt added successfully!');
        setIsFormOpen(false);
        setSelectedDebt(null);
      }
      loadDebts();
      loadStats();
      triggerRefresh();
    } catch (error) {
      toast.error('Failed to add debt');
    }
  };

  const handleUpdateDebt = async (data: any) => {
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
      loadDebts();
      loadStats();
      triggerRefresh();
    } catch (error) {
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
      loadDebts();
      loadStats();
      triggerRefresh();
    } catch (error) {
      toast.error('Failed to delete debt');
    }
  };

  const handleEditDebt = async (debt: any) => {
    const details = await loadDebtDetails(debt.id);
    if (details) {
      setSelectedDebt(details);
      setIsFormOpen(true);
    }
  };

  const handlePayment = () => {
    loadDebts();
    loadStats();
    triggerRefresh();
  };

  if (loading && !stats) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading debts...</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Debt Management</h1>
          <p className="text-muted-foreground mt-1">Track and pay off your debts</p>
        </div>
        <Button
          onClick={() => {
            setSelectedDebt(null);
            setIsFormOpen(true);
          }}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Debt
        </Button>
      </div>

      {/* Debt-Free Countdown */}
      {stats && stats.activeDebtCount > 0 && (
        <div className="mb-6">
          <DebtFreeCountdown key={`countdown-${refreshKey}`} />
        </div>
      )}

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-sm">Total Debt</p>
            <p className="text-2xl font-bold text-[var(--color-error)] mt-1">
              ${stats.totalRemainingBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-sm">Paid Off</p>
            <p className="text-2xl font-bold text-[var(--color-income)] mt-1">
              ${stats.totalPaidOff.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-sm">Progress</p>
            <p className="text-2xl font-bold text-foreground mt-1">{Math.round(stats.percentagePaidOff)}%</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-muted-foreground text-sm">Active Debts</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.activeDebtCount}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'paid_off'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded transition-colors capitalize ${
              filter === status
                ? 'bg-accent text-accent-foreground'
                : 'bg-card text-muted-foreground border border-border hover:bg-elevated'
            }`}
          >
            {status === 'paid_off' ? 'Paid Off' : status}
          </button>
        ))}
      </div>

      {/* Debts List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading debts...</p>
        </div>
      ) : debts.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-lg">
          <p className="text-muted-foreground">No debts yet. You're debt-free!</p>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="mt-4 bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            Add a Debt to Track
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Expand/Collapse All Controls */}
          {debts.length > 1 && (
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
                {debts.length} {debts.length === 1 ? 'debt' : 'debts'}
              </span>
            </div>
          )}

          {/* Debts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {debts.map((debt) => {
              // Get payoff timeline from strategy data for this debt
              const currentMethod = debtSettings?.preferredMethod || 'avalanche';
              const rolldownPayment = strategyData?.[currentMethod]?.rolldownPayments?.find(
                (r: { debtId: string }) => r.debtId === debt.id
              );
              const payoffTimeline = rolldownPayment ? {
                strategyMonths: rolldownPayment.payoffMonth,
                strategyDate: rolldownPayment.payoffDate,
                minimumOnlyMonths: rolldownPayment.minimumOnlyMonths,
                order: rolldownPayment.order,
                method: currentMethod,
              } : undefined;

              return (
                <DebtPayoffTracker
                  key={debt.id}
                  debt={debt}
                  onEdit={handleEditDebt}
                  onDelete={handleDeleteDebt}
                  onPayment={handlePayment}
                  defaultExpanded={allExpanded ?? false}
                  payoffTimeline={payoffTimeline}
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
              <Target className="w-6 h-6 text-[var(--color-primary)]" />
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
              <BarChart3 className="w-6 h-6 text-[var(--color-primary)]" />
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

      {/* What-If Calculator Section */}
      {stats && stats.activeDebtCount > 0 && debtSettings && (
        <div className="space-y-4">
          <button
            onClick={() => setShowWhatIf(!showWhatIf)}
            className="flex items-center justify-between w-full bg-card border border-border rounded-lg p-4 hover:bg-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <Lightbulb className="w-6 h-6 text-[var(--color-primary)]" />
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
              <AlertTriangle className="w-6 h-6 text-[var(--color-warning)]" />
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
          <DialogHeader className="flex-shrink-0">
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
