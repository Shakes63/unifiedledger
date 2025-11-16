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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useHousehold } from '@/contexts/household-context';

interface FinancialSettings {
  showCents: boolean;
  negativeNumberFormat: string;
  defaultTransactionType: string;
  combinedTransferView: boolean;
}

export function FinancialTab() {
  const { selectedHouseholdId } = useHousehold();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FinancialSettings>({
    showCents: true,
    negativeNumberFormat: '-$100',
    defaultTransactionType: 'expense',
    combinedTransferView: true,
  });

  const fetchSettings = async () => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/user/households/${selectedHouseholdId}/preferences`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setSettings({
          showCents: data.showCents !== false,
          negativeNumberFormat: data.negativeNumberFormat || '-$100',
          defaultTransactionType: data.defaultTransactionType || 'expense',
          combinedTransferView: data.combinedTransferView !== false,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load financial settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedHouseholdId) {
      fetchSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHouseholdId]);

  const handleSave = async () => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/user/households/${selectedHouseholdId}/preferences`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            showCents: settings.showCents,
            negativeNumberFormat: settings.negativeNumberFormat,
            defaultTransactionType: settings.defaultTransactionType,
            combinedTransferView: settings.combinedTransferView,
          }),
        }
      );

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
        <h2 className="text-xl font-semibold text-foreground">My Financial Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your personal financial display options for this household
        </p>
      </div>

      <div className="space-y-6">
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

        {/* Combined Transfer View */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="combinedTransferView" className="text-foreground">
                Combined Transfer View
              </Label>
              <p className="text-xs text-muted-foreground">
                Show transfers as single entries or display both transfer sides separately
              </p>
            </div>
            <Switch
              id="combinedTransferView"
              checked={settings.combinedTransferView}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, combinedTransferView: checked })
              }
            />
          </div>
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
