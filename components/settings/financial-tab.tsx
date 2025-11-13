'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface FinancialSettings {
  defaultBudgetMethod: string;
  budgetPeriod: string;
  showCents: boolean;
  negativeNumberFormat: string;
  defaultTransactionType: string;
  autoCategorization: boolean;
}

export function FinancialTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FinancialSettings>({
    defaultBudgetMethod: 'monthly',
    budgetPeriod: 'monthly',
    showCents: true,
    negativeNumberFormat: '-$100',
    defaultTransactionType: 'expense',
    autoCategorization: true,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings({
          defaultBudgetMethod: data.settings.defaultBudgetMethod || 'monthly',
          budgetPeriod: data.settings.budgetPeriod || 'monthly',
          showCents: data.settings.showCents !== false,
          negativeNumberFormat: data.settings.negativeNumberFormat || '-$100',
          defaultTransactionType: data.settings.defaultTransactionType || 'expense',
          autoCategorization: data.settings.autoCategorization !== false,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load financial settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        <h2 className="text-xl font-semibold text-foreground">Financial Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure budget preferences and financial display options
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
            Your preferred budgeting methodology
          </p>
        </div>

        {/* Budget Period */}
        <div className="space-y-2">
          <Label htmlFor="budgetPeriod" className="text-foreground">Budget Period</Label>
          <Select
            value={settings.budgetPeriod}
            onValueChange={(value) => setSettings({ ...settings, budgetPeriod: value })}
          >
            <SelectTrigger
              id="budgetPeriod"
              name="budgetPeriod"
              aria-label="Select budget period"
              className="bg-background border-border text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How often you want to track your budget
          </p>
        </div>

        {/* Show Cents */}
        <div className="space-y-2">
          <Label htmlFor="showCents" className="text-foreground">Amount Display</Label>
          <Select
            value={settings.showCents ? 'show' : 'hide'}
            onValueChange={(value) => setSettings({ ...settings, showCents: value === 'show' })}
          >
            <SelectTrigger
              id="showCents"
              name="showCents"
              aria-label="Select whether to show cents"
              className="bg-background border-border text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="show">Show Cents ($100.50)</SelectItem>
              <SelectItem value="hide">Hide Cents ($100)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Negative Format */}
        <div className="space-y-2">
          <Label htmlFor="negativeFormat" className="text-foreground">Negative Number Format</Label>
          <Select
            value={settings.negativeNumberFormat}
            onValueChange={(value) => setSettings({ ...settings, negativeNumberFormat: value })}
          >
            <SelectTrigger
              id="negativeFormat"
              name="negativeFormat"
              aria-label="Select negative number format"
              className="bg-background border-border text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-$100">-$100</SelectItem>
              <SelectItem value="($100)">($100)</SelectItem>
              <SelectItem value="$100-">$100-</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How negative amounts are displayed
          </p>
        </div>

        {/* Default Transaction Type */}
        <div className="space-y-2">
          <Label htmlFor="defaultTransactionType" className="text-foreground">
            Default Transaction Type
          </Label>
          <Select
            value={settings.defaultTransactionType}
            onValueChange={(value) => setSettings({ ...settings, defaultTransactionType: value })}
          >
            <SelectTrigger
              id="defaultTransactionType"
              name="defaultTransactionType"
              aria-label="Select default transaction type"
              className="bg-background border-border text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Pre-selected type when creating new transactions
          </p>
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
            Automatically apply categorization rules to new transactions
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
    </div>
  );
}
