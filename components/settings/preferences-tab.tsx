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

interface Account {
  id: string;
  name: string;
  type: string;
}

interface PreferencesData {
  currency: string;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  numberFormat: 'en-US' | 'en-GB' | 'de-DE' | 'fr-FR';
  defaultAccountId: string | null;
  firstDayOfWeek: 'sunday' | 'monday';
}

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar ($)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'GBP', label: 'GBP - British Pound (£)' },
  { value: 'CAD', label: 'CAD - Canadian Dollar (C$)' },
  { value: 'AUD', label: 'AUD - Australian Dollar (A$)' },
  { value: 'JPY', label: 'JPY - Japanese Yen (¥)' },
];

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2025)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2025)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2025-12-31)' },
];

const NUMBER_FORMATS = [
  { value: 'en-US', label: '1,000.00 (US)' },
  { value: 'en-GB', label: '1,000.00 (UK)' },
  { value: 'de-DE', label: '1.000,00 (Germany)' },
  { value: 'fr-FR', label: '1 000,00 (France)' },
];

export function PreferencesTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [preferences, setPreferences] = useState<PreferencesData>({
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    numberFormat: 'en-US',
    defaultAccountId: null,
    firstDayOfWeek: 'sunday',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch settings
      const settingsResponse = await fetch('/api/user/settings', { credentials: 'include' });
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setPreferences({
          currency: settingsData.settings.currency || 'USD',
          dateFormat: settingsData.settings.dateFormat || 'MM/DD/YYYY',
          numberFormat: settingsData.settings.numberFormat || 'en-US',
          defaultAccountId: settingsData.settings.defaultAccountId || null,
          firstDayOfWeek: settingsData.settings.firstDayOfWeek || 'sunday',
        });
      }

      // Fetch accounts
      const accountsResponse = await fetch('/api/accounts', { credentials: 'include' });
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        setAccounts(accountsData.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast.error('Failed to load preferences');
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
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save preferences');
      }

      toast.success('Preferences saved successfully');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save preferences');
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
        <h2 className="text-xl font-semibold text-foreground">Preferences</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your global display preferences that apply across all households
        </p>
      </div>

      <div className="space-y-6">
        {/* Currency */}
        <div className="space-y-2">
          <Label htmlFor="currency" className="text-foreground">Default Currency</Label>
          <Select
            value={preferences.currency}
            onValueChange={(value) => setPreferences({ ...preferences, currency: value })}
          >
            <SelectTrigger
              id="currency"
              name="currency"
              aria-label="Select default currency"
              className="bg-background border-border text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((currency) => (
                <SelectItem key={currency.value} value={currency.value}>
                  {currency.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Currency used for displaying amounts throughout the app
          </p>
        </div>

        {/* Date Format */}
        <div className="space-y-2">
          <Label htmlFor="dateFormat" className="text-foreground">Date Format</Label>
          <Select
            value={preferences.dateFormat}
            onValueChange={(value: PreferencesData['dateFormat']) => setPreferences({ ...preferences, dateFormat: value })}
          >
            <SelectTrigger
              id="dateFormat"
              name="dateFormat"
              aria-label="Select date format"
              className="bg-background border-border text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map((format) => (
                <SelectItem key={format.value} value={format.value}>
                  {format.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Number Format */}
        <div className="space-y-2">
          <Label htmlFor="numberFormat" className="text-foreground">Number Format</Label>
          <Select
            value={preferences.numberFormat}
            onValueChange={(value: PreferencesData['numberFormat']) => setPreferences({ ...preferences, numberFormat: value })}
          >
            <SelectTrigger
              id="numberFormat"
              name="numberFormat"
              aria-label="Select number format"
              className="bg-background border-border text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NUMBER_FORMATS.map((format) => (
                <SelectItem key={format.value} value={format.value}>
                  {format.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Default Account */}
        <div className="space-y-2">
          <Label htmlFor="defaultAccount" className="text-foreground">Default Account</Label>
          <Select
            value={preferences.defaultAccountId || 'none'}
            onValueChange={(value) =>
              setPreferences({ ...preferences, defaultAccountId: value === 'none' ? null : value })
            }
          >
            <SelectTrigger
              id="defaultAccount"
              name="defaultAccount"
              aria-label="Select default account"
              className="bg-background border-border text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No default account</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} ({account.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Account pre-selected when creating transactions
          </p>
        </div>

        {/* Start of Week */}
        <div className="space-y-2">
          <Label htmlFor="firstDayOfWeek" className="text-foreground">Start of Week</Label>
          <Select
            value={preferences.firstDayOfWeek}
            onValueChange={(value: PreferencesData['firstDayOfWeek']) =>
              setPreferences({ ...preferences, firstDayOfWeek: value })
            }
          >
            <SelectTrigger
              id="firstDayOfWeek"
              name="firstDayOfWeek"
              aria-label="Select first day of week"
              className="bg-background border-border text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sunday">Sunday</SelectItem>
              <SelectItem value="monday">Monday</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">First day of week for calendar views</p>
        </div>

        {/* Save Button */}
        <div className="pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
