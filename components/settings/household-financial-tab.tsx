'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, CreditCard, ExternalLink, Info, Calendar } from 'lucide-react';
import { useHousehold } from '@/contexts/household-context';
import Link from 'next/link';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HouseholdFinancialSettings {
  defaultBudgetMethod: string;
  autoCategorization: boolean;
}

interface DebtStrategySettings {
  debtStrategyEnabled: boolean;
  debtPayoffMethod: 'snowball' | 'avalanche';
  extraMonthlyPayment: number;
  paymentFrequency: 'weekly' | 'biweekly' | 'monthly';
}

export function HouseholdFinancialTab() {
  const { selectedHouseholdId } = useHousehold();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDebt, setSavingDebt] = useState(false);
  const [settings, setSettings] = useState<HouseholdFinancialSettings>({
    defaultBudgetMethod: 'monthly',
    autoCategorization: true,
  });
  const [debtSettings, setDebtSettings] = useState<DebtStrategySettings>({
    debtStrategyEnabled: false,
    debtPayoffMethod: 'avalanche',
    extraMonthlyPayment: 0,
    paymentFrequency: 'monthly',
  });

  const fetchSettings = useCallback(async () => {
    if (!selectedHouseholdId) return;
    
    try {
      // Fetch user settings
      const userResponse = await fetch('/api/user/settings', { credentials: 'include' });
      if (userResponse.ok) {
        const data = await userResponse.json();
        setSettings({
          defaultBudgetMethod: data.settings.defaultBudgetMethod || 'monthly',
          autoCategorization: data.settings.autoCategorization !== false,
        });
      }

      // Fetch household settings for debt strategy
      const householdResponse = await fetch(
        `/api/households/${selectedHouseholdId}/settings`,
        { credentials: 'include' }
      );
      if (householdResponse.ok) {
        const data = await householdResponse.json();
        setDebtSettings({
          debtStrategyEnabled: data.settings.debtStrategyEnabled ?? false,
          debtPayoffMethod: data.settings.debtPayoffMethod ?? 'avalanche',
          extraMonthlyPayment: data.settings.extraMonthlyPayment ?? 0,
          paymentFrequency: data.settings.paymentFrequency ?? 'monthly',
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load financial settings');
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      toast.success('Financial settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDebtStrategy = async () => {
    if (!selectedHouseholdId) return;
    
    setSavingDebt(true);
    try {
      const response = await fetch(
        `/api/households/${selectedHouseholdId}/settings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(debtSettings),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save debt strategy settings');
      }

      toast.success('Debt strategy settings saved');
    } catch (error) {
      console.error('Error saving debt strategy:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save debt strategy');
    } finally {
      setSavingDebt(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Household Financial Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Budget and financial settings shared by all members of this household
        </p>
      </div>

      <div className="space-y-6">
        {/* Budget Method */}
        <div className="space-y-2">
          <Label htmlFor="budgetMethod" className="text-foreground">Default Budget Method</Label>
          <Select
            value={settings.defaultBudgetMethod}
            onValueChange={(value) => setSettings({ ...settings, defaultBudgetMethod: value })}
          >
            <SelectTrigger
              id="budgetMethod"
              name="budgetMethod"
              aria-label="Select budget method"
              className="bg-background border-border text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly Budget</SelectItem>
              <SelectItem value="zero-based">Zero-Based Budget</SelectItem>
              <SelectItem value="50/30/20">50/30/20 Rule</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Budgeting methodology used by all household members
          </p>
        </div>

        {/* Budget Schedule Info */}
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Budget Schedule</p>
              <p className="text-sm text-muted-foreground mt-1">
                To configure your budget cycle (weekly, bi-weekly, semi-monthly, or monthly), 
                go to the Personal Preferences tab.
              </p>
              <Link
                href="/dashboard/settings?section=households&tab=personal"
                className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:opacity-80 transition-opacity mt-2"
              >
                Configure Budget Schedule
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Auto-categorization */}
        <div className="space-y-2">
          <Label htmlFor="autoCategorization" className="text-foreground">
            Auto-Categorization
          </Label>
          <Select
            value={settings.autoCategorization ? 'enabled' : 'disabled'}
            onValueChange={(value) =>
              setSettings({ ...settings, autoCategorization: value === 'enabled' })
            }
          >
            <SelectTrigger
              id="autoCategorization"
              name="autoCategorization"
              aria-label="Select auto-categorization setting"
              className="bg-background border-border text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Automatically apply categorization rules to new transactions for all household members
          </p>
        </div>

        {/* Save Button */}
        <div className="pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Financial Settings
          </Button>
        </div>
      </div>

      {/* Debt Payoff Strategy Section */}
      <div className="pt-6 border-t border-border">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-[var(--color-expense)]" />
          <h3 className="text-lg font-semibold text-foreground">Debt Payoff Strategy</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  When enabled, your debts are managed with a centralized payoff strategy.
                  In budget view, debts appear as a single &quot;Debt Payments&quot; line
                  instead of individual items.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="space-y-6">
          {/* Strategy Toggle */}
          <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
            <div className="flex-1">
              <Label htmlFor="debtStrategy" className="text-foreground font-medium">
                Use Debt Payoff Strategy
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {debtSettings.debtStrategyEnabled
                  ? 'Debts are managed by your payoff strategy'
                  : 'Each debt appears as an individual budget line'}
              </p>
            </div>
            <Switch
              id="debtStrategy"
              checked={debtSettings.debtStrategyEnabled}
              onCheckedChange={(checked) =>
                setDebtSettings({ ...debtSettings, debtStrategyEnabled: checked })
              }
            />
          </div>

          {/* Strategy Options (shown when enabled) */}
          {debtSettings.debtStrategyEnabled && (
            <div className="space-y-4 p-4 bg-elevated rounded-xl">
              {/* Payoff Method */}
              <div className="space-y-2">
                <Label htmlFor="payoffMethod" className="text-foreground">
                  Payoff Method
                </Label>
                <Select
                  value={debtSettings.debtPayoffMethod}
                  onValueChange={(value: 'snowball' | 'avalanche') =>
                    setDebtSettings({ ...debtSettings, debtPayoffMethod: value })
                  }
                >
                  <SelectTrigger
                    id="payoffMethod"
                    name="payoffMethod"
                    aria-label="Select payoff method"
                    className="bg-background border-border text-foreground"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avalanche">
                      Avalanche (Highest Interest First)
                    </SelectItem>
                    <SelectItem value="snowball">
                      Snowball (Lowest Balance First)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {debtSettings.debtPayoffMethod === 'avalanche'
                    ? 'Pays off highest interest debts first to minimize total interest paid'
                    : 'Pays off smallest balances first for quick wins and motivation'}
                </p>
              </div>

              {/* Extra Monthly Payment */}
              <div className="space-y-2">
                <Label htmlFor="extraPayment" className="text-foreground">
                  Extra Monthly Payment
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="extraPayment"
                    type="number"
                    min="0"
                    step="10"
                    value={debtSettings.extraMonthlyPayment}
                    onChange={(e) =>
                      setDebtSettings({
                        ...debtSettings,
                        extraMonthlyPayment: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="pl-7 bg-background border-border text-foreground"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Additional amount to put toward debt each month (applied to focus debt)
                </p>
              </div>

              {/* Payment Frequency */}
              <div className="space-y-2">
                <Label htmlFor="paymentFrequency" className="text-foreground">
                  Payment Frequency
                </Label>
                <Select
                  value={debtSettings.paymentFrequency}
                  onValueChange={(value: 'weekly' | 'biweekly' | 'monthly') =>
                    setDebtSettings({ ...debtSettings, paymentFrequency: value })
                  }
                >
                  <SelectTrigger
                    id="paymentFrequency"
                    name="paymentFrequency"
                    aria-label="Select payment frequency"
                    className="bg-background border-border text-foreground"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How often you make debt payments
                </p>
              </div>

              {/* Link to Debts Page */}
              <div className="pt-2">
                <Link
                  href="/dashboard/debts"
                  className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:opacity-80 transition-opacity"
                >
                  Manage individual debts
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <p className="text-xs text-muted-foreground mt-1">
                  Set which debts are included in the payoff strategy
                </p>
              </div>
            </div>
          )}

          {/* Manual Mode Info (shown when disabled) */}
          {!debtSettings.debtStrategyEnabled && (
            <div className="p-4 bg-muted/30 border border-border rounded-xl">
              <p className="text-sm text-muted-foreground">
                With strategy mode disabled, each debt appears as a separate line in your budget.
                You can set custom payment amounts for each debt individually.
              </p>
              <Link
                href="/dashboard/debts"
                className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:opacity-80 transition-opacity mt-2"
              >
                View and manage debts
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}

          {/* Save Debt Strategy Button */}
          <div className="pt-2">
            <Button
              onClick={handleSaveDebtStrategy}
              disabled={savingDebt}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
            >
              {savingDebt && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Debt Strategy Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
