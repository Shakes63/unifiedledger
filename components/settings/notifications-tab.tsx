'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import {
  Receipt,
  AlertTriangle,
  Wallet,
  Target,
  Calendar,
  Bell,
  Mail,
  Moon,
  Loader2,
  AlertCircle,
  DollarSign,
} from 'lucide-react';

type NotificationChannel = 'push' | 'email';

interface NotificationPreferences {
  id: string;
  userId: string;
  householdId: string | null;
  billReminderEnabled: boolean;
  billReminderDaysBefore: number;
  billReminderOnDueDate: boolean;
  billOverdueReminder: boolean;
  billReminderChannels: string; // JSON array
  budgetWarningEnabled: boolean;
  budgetWarningThreshold: number;
  budgetExceededAlert: boolean;
  budgetWarningChannels: string;
  budgetExceededChannels: string;
  budgetReviewEnabled: boolean;
  budgetReviewChannels: string;
  lowBalanceAlertEnabled: boolean;
  lowBalanceThreshold: number;
  lowBalanceChannels: string;
  savingsMilestoneEnabled: boolean;
  savingsMilestoneChannels: string;
  debtMilestoneEnabled: boolean;
  debtMilestoneChannels: string;
  weeklySummaryEnabled: boolean;
  weeklySummaryDay: string;
  weeklySummaryChannels: string;
  monthlySummaryEnabled: boolean;
  monthlySummaryDay: number;
  monthlySummaryChannels: string;
  pushNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  emailAddress: string | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch preferences on mount
  useEffect(() => {
    fetchPreferences();
  }, []);

  async function fetchPreferences() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/settings/notification-preferences');

      if (!response.ok) {
        throw new Error('Failed to fetch notification preferences');
      }

      const data = await response.json();
      setPreferences(data);
    } catch (err) {
      console.error('Error fetching preferences:', err);
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
      toast.error('Failed to load notification preferences');
    } finally {
      setIsLoading(false);
    }
  }

  // Parse channel JSON string to array
  const parseChannels = (channelString: string): NotificationChannel[] => {
    try {
      return JSON.parse(channelString);
    } catch {
      return ['push'];
    }
  };

  // Update preference function
  const updatePreference = useCallback(
    async (key: keyof NotificationPreferences, value: any) => {
      if (!preferences) return;

      // Optimistically update UI
      const previous = preferences;
      setPreferences({ ...preferences, [key]: value });
      setIsSaving(true);

      try {
        const response = await fetch('/api/settings/notification-preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: value }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update preference');
        }

        const updated = await response.json();
        setPreferences(updated);
        toast.success('Preference updated');
      } catch (err) {
        console.error('Error updating preference:', err);
        // Revert on error
        setPreferences(previous);
        toast.error(err instanceof Error ? err.message : 'Failed to update preference');
      } finally {
        setIsSaving(false);
      }
    },
    [preferences]
  );

  // Toggle channel in channel array
  const toggleChannel = useCallback(
    (channelField: keyof NotificationPreferences, channel: NotificationChannel) => {
      if (!preferences) return;

      const currentChannels = parseChannels(preferences[channelField] as string);
      const newChannels = currentChannels.includes(channel)
        ? currentChannels.filter((ch) => ch !== channel)
        : [...currentChannels, channel];

      // Prevent removing all channels
      if (newChannels.length === 0) {
        toast.error('At least one notification channel must be selected');
        return;
      }

      updatePreference(channelField, newChannels);
    },
    [preferences, updatePreference]
  );

  // Render channel selectors
  const ChannelSelector = ({
    channelField,
    enabled,
  }: {
    channelField: keyof NotificationPreferences;
    enabled: boolean;
  }) => {
    if (!preferences) return null;

    const selectedChannels = parseChannels(preferences[channelField] as string);

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
                aria-label={`Toggle ${channel.label} for ${String(channelField)}`}
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error || !preferences) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="h-12 w-12 text-[var(--color-error)]" />
        <p className="text-foreground font-medium">Failed to load preferences</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={fetchPreferences}
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
          <h2 className="text-xl font-semibold text-foreground">Notification Preferences</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage how and when you receive notifications
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
                Get notified before bills are due and when they're overdue
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
                checked={preferences.billReminderEnabled}
                onCheckedChange={(value) => updatePreference('billReminderEnabled', value)}
                aria-label="Toggle bill reminders"
              />
            </div>

            {/* Channel selector */}
            <ChannelSelector
              channelField="billReminderChannels"
              enabled={preferences.billReminderEnabled}
            />

            {/* Days before due date */}
            <div className="space-y-2">
              <Label htmlFor="bill-reminder-days" className="text-sm font-medium">
                Remind me how many days before due date
              </Label>
              <Input
                id="bill-reminder-days"
                name="bill-reminder-days"
                type="number"
                min={1}
                max={14}
                value={preferences.billReminderDaysBefore}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value >= 1 && value <= 14) {
                    updatePreference('billReminderDaysBefore', value);
                  }
                }}
                disabled={!preferences.billReminderEnabled}
                className="w-24 bg-background border-border disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">Between 1-14 days</p>
            </div>

            {/* On due date */}
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <Label htmlFor="bill-on-due-date" className="text-sm font-medium">
                  Send reminder on due date
                </Label>
                <p className="text-xs text-muted-foreground">
                  Remind me again when the bill is due today
                </p>
              </div>
              <Switch
                id="bill-on-due-date"
                checked={preferences.billReminderOnDueDate}
                onCheckedChange={(value) => updatePreference('billReminderOnDueDate', value)}
                disabled={!preferences.billReminderEnabled}
                aria-label="Toggle reminder on due date"
              />
            </div>

            {/* Overdue reminders */}
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <Label htmlFor="bill-overdue" className="text-sm font-medium">
                  Send overdue reminders
                </Label>
                <p className="text-xs text-muted-foreground">
                  Alert me when bills are past their due date
                </p>
              </div>
              <Switch
                id="bill-overdue"
                checked={preferences.billOverdueReminder}
                onCheckedChange={(value) => updatePreference('billOverdueReminder', value)}
                disabled={!preferences.billReminderEnabled}
                aria-label="Toggle overdue reminders"
              />
            </div>
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
                Track your spending and get alerts when approaching budget limits
              </p>
            </div>

            {/* Enable budget warnings */}
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <Label htmlFor="budget-warning-enabled" className="text-sm font-medium">
                  Enable budget warnings
                </Label>
              </div>
              <Switch
                id="budget-warning-enabled"
                checked={preferences.budgetWarningEnabled}
                onCheckedChange={(value) => updatePreference('budgetWarningEnabled', value)}
                aria-label="Toggle budget warnings"
              />
            </div>

            {/* Channel selector */}
            <ChannelSelector
              channelField="budgetWarningChannels"
              enabled={preferences.budgetWarningEnabled}
            />

            {/* Budget warning threshold */}
            <div className="space-y-4">
              <Label htmlFor="budget-threshold" className="text-sm font-medium">
                Alert me at what percentage of budget
              </Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="budget-threshold"
                  value={[preferences.budgetWarningThreshold]}
                  onValueChange={([value]) => updatePreference('budgetWarningThreshold', value)}
                  min={50}
                  max={100}
                  step={5}
                  className="flex-1"
                  disabled={!preferences.budgetWarningEnabled}
                  aria-label="Budget warning threshold percentage"
                />
                <span className="text-sm font-medium w-12 text-right text-foreground">
                  {preferences.budgetWarningThreshold}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                You'll be notified when spending reaches this percentage
              </p>
            </div>

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
                  checked={preferences.budgetExceededAlert}
                  onCheckedChange={(value) => updatePreference('budgetExceededAlert', value)}
                  disabled={!preferences.budgetWarningEnabled}
                  aria-label="Toggle budget exceeded alerts"
                />
              </div>
              <ChannelSelector
                channelField="budgetExceededChannels"
                enabled={preferences.budgetExceededAlert && preferences.budgetWarningEnabled}
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
              </div>
              <Switch
                id="low-balance-enabled"
                checked={preferences.lowBalanceAlertEnabled}
                onCheckedChange={(value) => updatePreference('lowBalanceAlertEnabled', value)}
                aria-label="Toggle low balance alerts"
              />
            </div>

            {/* Channel selector */}
            <ChannelSelector
              channelField="lowBalanceChannels"
              enabled={preferences.lowBalanceAlertEnabled}
            />

            {/* Low balance threshold */}
            <div className="space-y-2">
              <Label htmlFor="low-balance-threshold" className="text-sm font-medium">
                Alert when balance falls below
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="low-balance-threshold"
                  name="low-balance-threshold"
                  type="number"
                  min={0}
                  step={10}
                  value={preferences.lowBalanceThreshold}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (value >= 0) {
                      updatePreference('lowBalanceThreshold', value);
                    }
                  }}
                  className="pl-9 bg-background border-border disabled:opacity-50"
                  disabled={!preferences.lowBalanceAlertEnabled}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Applies to checking and savings accounts only
              </p>
            </div>
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
                  checked={preferences.savingsMilestoneEnabled}
                  onCheckedChange={(value) => updatePreference('savingsMilestoneEnabled', value)}
                  aria-label="Toggle savings milestone notifications"
                />
              </div>
              <ChannelSelector
                channelField="savingsMilestoneChannels"
                enabled={preferences.savingsMilestoneEnabled}
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
                  checked={preferences.debtMilestoneEnabled}
                  onCheckedChange={(value) => updatePreference('debtMilestoneEnabled', value)}
                  aria-label="Toggle debt milestone notifications"
                />
              </div>
              <ChannelSelector
                channelField="debtMilestoneChannels"
                enabled={preferences.debtMilestoneEnabled}
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
                </div>
                <Switch
                  id="weekly-summary"
                  checked={preferences.weeklySummaryEnabled}
                  onCheckedChange={(value) => updatePreference('weeklySummaryEnabled', value)}
                  aria-label="Toggle weekly summary"
                />
              </div>

              <ChannelSelector
                channelField="weeklySummaryChannels"
                enabled={preferences.weeklySummaryEnabled}
              />

              <div className="space-y-2">
                <Label htmlFor="weekly-day" className="text-sm font-medium">
                  Send weekly summary on
                </Label>
                <Select
                  value={preferences.weeklySummaryDay}
                  onValueChange={(value) => updatePreference('weeklySummaryDay', value)}
                  disabled={!preferences.weeklySummaryEnabled}
                >
                  <SelectTrigger
                    id="weekly-day"
                    name="weekly-day"
                    aria-label="Select day for weekly summary"
                    className="bg-background border-border disabled:opacity-50"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunday">Sunday</SelectItem>
                    <SelectItem value="monday">Monday</SelectItem>
                    <SelectItem value="tuesday">Tuesday</SelectItem>
                    <SelectItem value="wednesday">Wednesday</SelectItem>
                    <SelectItem value="thursday">Thursday</SelectItem>
                    <SelectItem value="friday">Friday</SelectItem>
                    <SelectItem value="saturday">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Monthly summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <Label htmlFor="monthly-summary" className="text-sm font-medium">
                    Enable monthly summary
                  </Label>
                </div>
                <Switch
                  id="monthly-summary"
                  checked={preferences.monthlySummaryEnabled}
                  onCheckedChange={(value) => updatePreference('monthlySummaryEnabled', value)}
                  aria-label="Toggle monthly summary"
                />
              </div>

              <ChannelSelector
                channelField="monthlySummaryChannels"
                enabled={preferences.monthlySummaryEnabled}
              />

              <div className="space-y-2">
                <Label htmlFor="monthly-day" className="text-sm font-medium">
                  Send monthly summary on day
                </Label>
                <Input
                  id="monthly-day"
                  name="monthly-day"
                  type="number"
                  min={1}
                  max={28}
                  value={preferences.monthlySummaryDay}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (value >= 1 && value <= 28) {
                      updatePreference('monthlySummaryDay', value);
                    }
                  }}
                  disabled={!preferences.monthlySummaryEnabled}
                  className="w-24 bg-background border-border disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground">Day of the month (1-28)</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 6. Global Settings */}
      <Card className="border-border bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 p-2 rounded-lg bg-elevated">
            <Bell className="h-5 w-5 text-[var(--color-primary)]" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Global Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure email address and quiet hours for all notifications
              </p>
            </div>

            {/* Email address for all email notifications */}
            <div className="space-y-2">
              <Label htmlFor="email-address" className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email address
              </Label>
              <Input
                id="email-address"
                name="email-address"
                type="email"
                placeholder="your@email.com"
                value={preferences.emailAddress || ''}
                onChange={(e) => updatePreference('emailAddress', e.target.value)}
                className="bg-background border-border"
              />
              <p className="text-xs text-[var(--color-warning)] flex items-start gap-1">
                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>Email notifications will be available in a future update</span>
              </p>
            </div>

            {/* Quiet hours */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Quiet hours</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Don't send notifications during these hours (24-hour format)
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quiet-start" className="text-sm font-medium">
                    Start time
                  </Label>
                  <Input
                    id="quiet-start"
                    name="quiet-start"
                    type="time"
                    value={preferences.quietHoursStart || ''}
                    onChange={(e) => updatePreference('quietHoursStart', e.target.value || null)}
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiet-end" className="text-sm font-medium">
                    End time
                  </Label>
                  <Input
                    id="quiet-end"
                    name="quiet-end"
                    type="time"
                    value={preferences.quietHoursEnd || ''}
                    onChange={(e) => updatePreference('quietHoursEnd', e.target.value || null)}
                    className="bg-background border-border"
                  />
                </div>
              </div>
              {(preferences.quietHoursStart || preferences.quietHoursEnd) && (
                <p className="text-xs text-[var(--color-warning)] flex items-start gap-1">
                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>Quiet hours will be enforced in a future update</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
