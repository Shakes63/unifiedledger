'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, Loader2, Palette, Bell, DollarSign, Mail } from 'lucide-react';
import { type Theme } from '@/lib/themes/theme-config';
import { getAllThemes, getTheme, applyTheme } from '@/lib/themes/theme-utils';
import { toast } from 'sonner';
import { useHousehold } from '@/contexts/household-context';

type NotificationChannel = 'push' | 'email';

// Preference value type - can be boolean, number, string, or channel array
type PreferenceValue = boolean | number | string | NotificationChannel[];

// User household preferences shape - API returns flexible structure
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserHouseholdPreferences = Record<string, any>;

const CHANNELS: Array<{
  id: NotificationChannel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  available: boolean;
  description: string;
}> = [
  { id: 'push', label: 'Push', icon: Bell, available: true, description: 'Browser notifications' },
  { id: 'email', label: 'Email', icon: Mail, available: false, description: 'Coming soon' },
];

interface HouseholdPersonalTabProps {
  householdId: string;
}

export function HouseholdPersonalTab({ householdId }: HouseholdPersonalTabProps) {
  const { selectedHousehold, refreshPreferences } = useHousehold();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Theme state
  const [currentThemeId, setCurrentThemeId] = useState<string>('dark-mode');
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('dark-mode');
  
  // Financial display state
  const [financialSettings, setFinancialSettings] = useState({
    showCents: true,
    negativeNumberFormat: '-$100',
    defaultTransactionType: 'expense',
    combinedTransferView: true,
  });
  
  // Notifications state
  const [preferences, setPreferences] = useState<UserHouseholdPreferences | null>(null);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  const allThemes = getAllThemes();

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user/households/${householdId}/preferences`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data);
        
        // Set theme
        if (data.theme) {
          setCurrentThemeId(data.theme);
          setSelectedThemeId(data.theme);
          const theme = getTheme(data.theme);
          setCurrentTheme(theme);
        }
        
        // Set financial settings
        setFinancialSettings({
          showCents: data.showCents !== false,
          negativeNumberFormat: data.negativeNumberFormat || '-$100',
          defaultTransactionType: data.defaultTransactionType || 'expense',
          combinedTransferView: data.combinedTransferView !== false,
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  // Fetch household preferences
  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // Update current theme when ID changes
  useEffect(() => {
    const theme = getTheme(currentThemeId);
    setCurrentTheme(theme);
  }, [currentThemeId]);

  const handleThemeSelect = (themeId: string) => {
    const theme = getTheme(themeId);
    if (!theme || !theme.isAvailable) {
      toast.error('This theme is not available yet');
      return;
    }
    setSelectedThemeId(themeId);
  };

  const handleSaveTheme = async () => {
    if (selectedThemeId === currentThemeId) {
      toast.info('This theme is already active');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/user/households/${householdId}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: selectedThemeId }),
      });

      if (response.ok) {
        setCurrentThemeId(selectedThemeId);
        toast.success('Theme updated successfully!');
        applyTheme(selectedThemeId);
        await refreshPreferences();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update theme');
      }
    } catch (error) {
      console.error('Failed to save theme:', error);
      toast.error('Failed to save theme');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFinancial = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/user/households/${householdId}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(financialSettings),
      });

      if (response.ok) {
        toast.success('Financial settings saved successfully');
        await refreshPreferences();
        // Note: Transaction lists will reflect the new preference on next page refresh or fetch
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save financial settings');
      }
    } catch (error) {
      console.error('Error saving financial settings:', error);
      toast.error('Failed to save financial settings');
    } finally {
      setSaving(false);
    }
  };

  const parseChannels = (channelString: string | null | undefined): NotificationChannel[] => {
    if (!channelString) return ['push'];
    try {
      return JSON.parse(channelString);
    } catch {
      return ['push'];
    }
  };

  const updatePreference = useCallback(
    async (key: string, value: PreferenceValue) => {
      if (!preferences) return;

      setIsSavingNotifications(true);

      try {
        const response = await fetch(`/api/user/households/${householdId}/preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ [key]: value }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update preference');
        }

        await refreshPreferences();
        const updatedData = await response.json();
        setPreferences(updatedData.preferences || updatedData);
        toast.success('Preference updated');
      } catch (err) {
        console.error('Error updating preference:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to update preference');
      } finally {
        setIsSavingNotifications(false);
      }
    },
    [householdId, preferences, refreshPreferences]
  );

  const toggleChannel = useCallback(
    (channelField: string, channel: NotificationChannel) => {
      if (!preferences) return;

      const currentChannels = parseChannels(preferences[channelField as keyof typeof preferences] as string);
      const newChannels = currentChannels.includes(channel)
        ? currentChannels.filter((ch) => ch !== channel)
        : [...currentChannels, channel];

      if (newChannels.length === 0) {
        toast.error('At least one notification channel must be selected');
        return;
      }

      updatePreference(channelField, JSON.stringify(newChannels));
    },
    [preferences, updatePreference]
  );

  const ChannelSelector = ({
    channelField,
    enabled,
  }: {
    channelField: string;
    enabled: boolean;
  }) => {
    if (!preferences) return null;

    const selectedChannels = parseChannels(preferences[channelField as keyof typeof preferences] as string);

    return (
      <div className="space-y-2 pl-6 border-l-2 border-border">
        <Label className="text-xs font-medium text-muted-foreground">Delivery channels</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CHANNELS.map((channel) => (
            <div
              key={channel.id}
              className="flex items-center space-x-2 p-2 rounded-md bg-elevated/50 border border-border"
            >
              <Checkbox
                id={`${channelField}-${channel.id}`}
                checked={selectedChannels.includes(channel.id)}
                onCheckedChange={() => toggleChannel(channelField, channel.id)}
                disabled={!enabled || !channel.available}
                aria-label={`Toggle ${channel.label} for ${channelField}`}
              />
              <div className="flex items-center gap-2 flex-1">
                <channel.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <Label
                  htmlFor={`${channelField}-${channel.id}`}
                  className={`text-xs cursor-pointer ${
                    !enabled || !channel.available ? 'opacity-50' : ''
                  }`}
                >
                  {channel.label}
                </Label>
                {!channel.available && (
                  <span className="text-[10px] text-[var(--color-warning)] ml-auto">
                    {channel.description}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading || !currentTheme || !preferences) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Personal Preferences</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your personal settings for{' '}
          <span className="font-medium text-foreground">
            {selectedHousehold?.name || 'this household'}
          </span>
          {' '}(only visible to you)
        </p>
      </div>

      {/* Theme Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-lg font-semibold text-foreground">Theme</h3>
        </div>

        {/* Current Theme */}
        <Card className="p-6 border border-border bg-card mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-lg font-bold text-foreground">{currentTheme.name}</h4>
                <span className="px-2 py-1 bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Active
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{currentTheme.description}</p>
            </div>
          </div>
        </Card>

        {/* Theme Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {allThemes.map((theme) => {
            const isSelected = selectedThemeId === theme.id;
            const isCurrent = currentThemeId === theme.id;
            const isAvailable = theme.isAvailable;

            return (
              <Card
                key={theme.id}
                className={`p-4 border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-border bg-card hover:bg-elevated'
                } ${!isAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={() => isAvailable && handleThemeSelect(theme.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-foreground">{theme.name}</h4>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-xs rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{theme.description}</p>
                  </div>
                  {isSelected && isAvailable && (
                    <Check className="w-5 h-5 text-[var(--color-primary)]" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {selectedThemeId !== currentThemeId && (
          <div className="flex justify-end mb-6">
            <Button
              onClick={handleSaveTheme}
              disabled={saving}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Apply Theme
            </Button>
          </div>
        )}
      </div>

      <Separator className="bg-border" />

      {/* Financial Display Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-lg font-semibold text-foreground">Financial Display</h3>
        </div>

        <Card className="p-6 border border-border bg-card">
          <div className="space-y-6">
            {/* Show Cents */}
            <div className="space-y-2">
              <Label htmlFor="showCents" className="text-foreground">Amount Display</Label>
              <Select
                value={financialSettings.showCents ? 'show' : 'hide'}
                onValueChange={(value) =>
                  setFinancialSettings({ ...financialSettings, showCents: value === 'show' })
                }
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
                value={financialSettings.negativeNumberFormat}
                onValueChange={(value) =>
                  setFinancialSettings({ ...financialSettings, negativeNumberFormat: value })
                }
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
            </div>

            {/* Default Transaction Type */}
            <div className="space-y-2">
              <Label htmlFor="defaultTransactionType" className="text-foreground">
                Default Transaction Type
              </Label>
              <Select
                value={financialSettings.defaultTransactionType}
                onValueChange={(value) =>
                  setFinancialSettings({ ...financialSettings, defaultTransactionType: value })
                }
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
                  checked={financialSettings.combinedTransferView}
                  onCheckedChange={(checked) =>
                    setFinancialSettings({ ...financialSettings, combinedTransferView: checked })
                  }
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <Button
                onClick={handleSaveFinancial}
                disabled={saving}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Financial Settings
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Separator className="bg-border" />

      {/* Notifications Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-lg font-semibold text-foreground">Notifications</h3>
          {isSavingNotifications && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Bill Reminders */}
          <Card className="border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="bill-reminder-enabled" className="text-sm font-medium">
                  Bill Reminders
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Get notified when bills are due
                </p>
              </div>
              <Switch
                id="bill-reminder-enabled"
                checked={preferences.billRemindersEnabled}
                onCheckedChange={(value) => updatePreference('billRemindersEnabled', value)}
              />
            </div>
            <ChannelSelector
              channelField="billRemindersChannels"
              enabled={preferences.billRemindersEnabled ?? false}
            />
          </Card>

          {/* Budget Warnings */}
          <Card className="border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <Label htmlFor="budget-warning-enabled" className="text-sm font-medium">
                  Budget Warnings
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Get notified when approaching budget limits
                </p>
              </div>
              <Switch
                id="budget-warning-enabled"
                checked={preferences.budgetWarningsEnabled}
                onCheckedChange={(value) => updatePreference('budgetWarningsEnabled', value)}
              />
            </div>
            <ChannelSelector
              channelField="budgetWarningsChannels"
              enabled={preferences.budgetWarningsEnabled}
            />
          </Card>

          {/* Budget Exceeded */}
          <Card className="border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <Label htmlFor="budget-exceeded" className="text-sm font-medium">
                  Budget Exceeded Alerts
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Get immediate notification when you go over budget
                </p>
              </div>
              <Switch
                id="budget-exceeded"
                checked={preferences.budgetExceededEnabled}
                onCheckedChange={(value) => updatePreference('budgetExceededEnabled', value)}
              />
            </div>
            <ChannelSelector
              channelField="budgetExceededChannels"
              enabled={preferences.budgetExceededEnabled}
            />
          </Card>

          {/* Low Balance */}
          <Card className="border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <Label htmlFor="low-balance-enabled" className="text-sm font-medium">
                  Low Balance Alerts
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Get notified when account balances fall below threshold
                </p>
              </div>
              <Switch
                id="low-balance-enabled"
                checked={preferences.lowBalanceEnabled}
                onCheckedChange={(value) => updatePreference('lowBalanceEnabled', value)}
              />
            </div>
            <ChannelSelector
              channelField="lowBalanceChannels"
              enabled={preferences.lowBalanceEnabled}
            />
          </Card>

          {/* Savings Milestones */}
          <Card className="border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <Label htmlFor="savings-milestones" className="text-sm font-medium">
                  Savings Goal Milestones
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Get notified when you reach goal milestones
                </p>
              </div>
              <Switch
                id="savings-milestones"
                checked={preferences.savingsMilestonesEnabled}
                onCheckedChange={(value) => updatePreference('savingsMilestonesEnabled', value)}
              />
            </div>
            <ChannelSelector
              channelField="savingsMilestonesChannels"
              enabled={preferences.savingsMilestonesEnabled}
            />
          </Card>

          {/* Debt Milestones */}
          <Card className="border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <Label htmlFor="debt-milestones" className="text-sm font-medium">
                  Debt Payoff Milestones
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Get notified as you pay down debts at key milestones
                </p>
              </div>
              <Switch
                id="debt-milestones"
                checked={preferences.debtMilestonesEnabled}
                onCheckedChange={(value) => updatePreference('debtMilestonesEnabled', value)}
              />
            </div>
            <ChannelSelector
              channelField="debtMilestonesChannels"
              enabled={preferences.debtMilestonesEnabled}
            />
          </Card>

          {/* Weekly Summary */}
          <Card className="border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <Label htmlFor="weekly-summary" className="text-sm font-medium">
                  Weekly Summary
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Get a weekly overview of your financial activity
                </p>
              </div>
              <Switch
                id="weekly-summary"
                checked={preferences.weeklySummariesEnabled}
                onCheckedChange={(value) => updatePreference('weeklySummariesEnabled', value)}
              />
            </div>
            <ChannelSelector
              channelField="weeklySummariesChannels"
              enabled={preferences.weeklySummariesEnabled}
            />
          </Card>

          {/* Monthly Summary */}
          <Card className="border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <Label htmlFor="monthly-summary" className="text-sm font-medium">
                  Monthly Summary
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Get a monthly overview of your financial activity
                </p>
              </div>
              <Switch
                id="monthly-summary"
                checked={preferences.monthlySummariesEnabled}
                onCheckedChange={(value) => updatePreference('monthlySummariesEnabled', value)}
              />
            </div>
            <ChannelSelector
              channelField="monthlySummariesChannels"
              enabled={preferences.monthlySummariesEnabled}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

