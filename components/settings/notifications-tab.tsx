'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Receipt,
  AlertTriangle,
  Wallet,
  Target,
  Calendar,
  Bell,
  Mail,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useHousehold } from '@/contexts/household-context';

type NotificationChannel = 'push' | 'email';

// Available notification channels with metadata
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

export function NotificationsTab() {
  const { preferences, preferencesLoading, refreshPreferences, selectedHousehold } = useHousehold();
  const [isSaving, setIsSaving] = useState(false);

  // Parse channel JSON string to array
  const parseChannels = (channelString: string | null | undefined): NotificationChannel[] => {
    if (!channelString) return ['push'];
    try {
      return JSON.parse(channelString);
    } catch {
      return ['push'];
    }
  };

  // Update preference function
  const updatePreference = useCallback(
    async (key: string, value: any) => {
      if (!selectedHousehold || !preferences) return;

      setIsSaving(true);

      try {
        const response = await fetch(`/api/user/households/${selectedHousehold.id}/preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ [key]: value }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update preference');
        }

        // Refresh preferences from context to update UI
        await refreshPreferences();
        toast.success('Preference updated');
      } catch (err) {
        console.error('Error updating preference:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to update preference');
      } finally {
        setIsSaving(false);
      }
    },
    [selectedHousehold, preferences, refreshPreferences]
  );

  // Toggle channel in channel array
  const toggleChannel = useCallback(
    (channelField: string, channel: NotificationChannel) => {
      if (!preferences) return;

      const currentChannels = parseChannels(preferences[channelField as keyof typeof preferences] as string);
      const newChannels = currentChannels.includes(channel)
        ? currentChannels.filter((ch) => ch !== channel)
        : [...currentChannels, channel];

      // Prevent removing all channels
      if (newChannels.length === 0) {
        toast.error('At least one notification channel must be selected');
        return;
      }

      updatePreference(channelField, JSON.stringify(newChannels));
    },
    [preferences, updatePreference]
  );

  // Render channel selectors
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
        {!enabled && (
          <p className="text-xs text-muted-foreground italic">
            Enable this notification type to configure channels
          </p>
        )}
      </div>
    );
  };

  if (preferencesLoading || !selectedHousehold) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="h-12 w-12 text-[var(--color-error)]" />
        <p className="text-foreground font-medium">Failed to load preferences</p>
        <p className="text-sm text-muted-foreground">
          Unable to load notification preferences for this household
        </p>
        <button
          onClick={refreshPreferences}
          className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Notifications for {selectedHousehold.name}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage notification preferences for this household
          </p>
        </div>
        {isSaving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving...</span>
          </div>
        )}
      </div>

      {/* 1. Bill Reminders */}
      <Card className="border-border bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 p-2 rounded-lg bg-elevated">
            <Receipt className="h-5 w-5 text-[var(--color-primary)]" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Bill Reminders</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Get notified when bills are due
              </p>
            </div>

            {/* Enable bill reminders */}
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <Label htmlFor="bill-reminder-enabled" className="text-sm font-medium">
                  Enable bill reminders
                </Label>
              </div>
              <Switch
                id="bill-reminder-enabled"
                checked={preferences.billRemindersEnabled}
                onCheckedChange={(value) => updatePreference('billRemindersEnabled', value)}
                aria-label="Toggle bill reminders"
              />
            </div>

            {/* Channel selector */}
            <ChannelSelector
              channelField="billRemindersChannels"
              enabled={preferences.billRemindersEnabled}
            />
          </div>
        </div>
      </Card>

      {/* 2. Budget Alerts */}
      <Card className="border-border bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 p-2 rounded-lg bg-elevated">
            <AlertTriangle className="h-5 w-5 text-[var(--color-warning)]" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Budget Alerts</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Track your spending and get alerts about your budgets
              </p>
            </div>

            {/* Enable budget warnings */}
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <Label htmlFor="budget-warning-enabled" className="text-sm font-medium">
                  Enable budget warnings
                </Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when you're approaching your budget limits
                </p>
              </div>
              <Switch
                id="budget-warning-enabled"
                checked={preferences.budgetWarningsEnabled}
                onCheckedChange={(value) => updatePreference('budgetWarningsEnabled', value)}
                aria-label="Toggle budget warnings"
              />
            </div>

            {/* Channel selector */}
            <ChannelSelector
              channelField="budgetWarningsChannels"
              enabled={preferences.budgetWarningsEnabled}
            />

            {/* Budget exceeded */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <Label htmlFor="budget-exceeded" className="text-sm font-medium">
                    Alert when budget is exceeded
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Get immediate notification when you go over budget
                  </p>
                </div>
                <Switch
                  id="budget-exceeded"
                  checked={preferences.budgetExceededEnabled}
                  onCheckedChange={(value) => updatePreference('budgetExceededEnabled', value)}
                  aria-label="Toggle budget exceeded alerts"
                />
              </div>
              <ChannelSelector
                channelField="budgetExceededChannels"
                enabled={preferences.budgetExceededEnabled}
              />
            </div>

            {/* Monthly budget review */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <Label htmlFor="budget-review" className="text-sm font-medium">
                    Enable monthly budget reviews
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Get a summary of your budget performance each month
                  </p>
                </div>
                <Switch
                  id="budget-review"
                  checked={preferences.budgetReviewEnabled}
                  onCheckedChange={(value) => updatePreference('budgetReviewEnabled', value)}
                  aria-label="Toggle monthly budget reviews"
                />
              </div>
              <ChannelSelector
                channelField="budgetReviewChannels"
                enabled={preferences.budgetReviewEnabled}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Account Alerts */}
      <Card className="border-border bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 p-2 rounded-lg bg-elevated">
            <Wallet className="h-5 w-5 text-[var(--color-primary)]" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Account Alerts</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Monitor your account balances and get low balance warnings
              </p>
            </div>

            {/* Enable low balance alerts */}
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <Label htmlFor="low-balance-enabled" className="text-sm font-medium">
                  Enable low balance alerts
                </Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when account balances fall below your threshold
                </p>
              </div>
              <Switch
                id="low-balance-enabled"
                checked={preferences.lowBalanceEnabled}
                onCheckedChange={(value) => updatePreference('lowBalanceEnabled', value)}
                aria-label="Toggle low balance alerts"
              />
            </div>

            {/* Channel selector */}
            <ChannelSelector
              channelField="lowBalanceChannels"
              enabled={preferences.lowBalanceEnabled}
            />
          </div>
        </div>
      </Card>

      {/* 4. Goals & Debts */}
      <Card className="border-border bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 p-2 rounded-lg bg-elevated">
            <Target className="h-5 w-5 text-[var(--color-success)]" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Goals & Debts</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Track progress towards savings goals and debt payoff milestones
              </p>
            </div>

            {/* Savings milestones */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <Label htmlFor="savings-milestones" className="text-sm font-medium">
                    Notify me of savings goal milestones
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Get notified when you reach 25%, 50%, 75%, and 100% of your goals
                  </p>
                </div>
                <Switch
                  id="savings-milestones"
                  checked={preferences.savingsMilestonesEnabled}
                  onCheckedChange={(value) => updatePreference('savingsMilestonesEnabled', value)}
                  aria-label="Toggle savings milestone notifications"
                />
              </div>
              <ChannelSelector
                channelField="savingsMilestonesChannels"
                enabled={preferences.savingsMilestonesEnabled}
              />
            </div>

            {/* Debt milestones */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <Label htmlFor="debt-milestones" className="text-sm font-medium">
                    Notify me of debt payoff milestones
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Get notified as you pay down your debts at key milestones
                  </p>
                </div>
                <Switch
                  id="debt-milestones"
                  checked={preferences.debtMilestonesEnabled}
                  onCheckedChange={(value) => updatePreference('debtMilestonesEnabled', value)}
                  aria-label="Toggle debt milestone notifications"
                />
              </div>
              <ChannelSelector
                channelField="debtMilestonesChannels"
                enabled={preferences.debtMilestonesEnabled}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 5. Summary Reports */}
      <Card className="border-border bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 p-2 rounded-lg bg-elevated">
            <Calendar className="h-5 w-5 text-[var(--color-primary)]" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Summary Reports</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Receive periodic summaries of your financial activity
              </p>
            </div>

            {/* Weekly summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <Label htmlFor="weekly-summary" className="text-sm font-medium">
                    Enable weekly summary
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Get a weekly overview of your financial activity
                  </p>
                </div>
                <Switch
                  id="weekly-summary"
                  checked={preferences.weeklySummariesEnabled}
                  onCheckedChange={(value) => updatePreference('weeklySummariesEnabled', value)}
                  aria-label="Toggle weekly summary"
                />
              </div>

              <ChannelSelector
                channelField="weeklySummariesChannels"
                enabled={preferences.weeklySummariesEnabled}
              />
            </div>

            {/* Monthly summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <Label htmlFor="monthly-summary" className="text-sm font-medium">
                    Enable monthly summary
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Get a monthly overview of your financial activity
                  </p>
                </div>
                <Switch
                  id="monthly-summary"
                  checked={preferences.monthlySummariesEnabled}
                  onCheckedChange={(value) => updatePreference('monthlySummariesEnabled', value)}
                  aria-label="Toggle monthly summary"
                />
              </div>

              <ChannelSelector
                channelField="monthlySummariesChannels"
                enabled={preferences.monthlySummariesEnabled}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
