'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface NotificationPreferences {
  id: string;
  userId: string;
  householdId?: string;
  billReminderEnabled: boolean;
  billReminderDaysBefore: number;
  billReminderOnDueDate: boolean;
  billOverdueReminder: boolean;
  budgetWarningEnabled: boolean;
  budgetWarningThreshold: number;
  budgetExceededAlert: boolean;
  lowBalanceAlertEnabled: boolean;
  lowBalanceThreshold: number;
  savingsMilestoneEnabled: boolean;
  debtMilestoneEnabled: boolean;
  weeklySummaryEnabled: boolean;
  weeklySummaryDay: string;
  monthlySummaryEnabled: boolean;
  monthlySummaryDay: number;
  pushNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  emailAddress?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notification-preferences');
      if (!response.ok) throw new Error('Failed to fetch preferences');

      const data = await response.json();
      setPreferences(data);
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast.error('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      const response = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billReminderEnabled: preferences.billReminderEnabled,
          billReminderDaysBefore: preferences.billReminderDaysBefore,
          billReminderOnDueDate: preferences.billReminderOnDueDate,
          billOverdueReminder: preferences.billOverdueReminder,
          budgetWarningEnabled: preferences.budgetWarningEnabled,
          budgetWarningThreshold: preferences.budgetWarningThreshold,
          budgetExceededAlert: preferences.budgetExceededAlert,
          lowBalanceAlertEnabled: preferences.lowBalanceAlertEnabled,
          lowBalanceThreshold: preferences.lowBalanceThreshold,
          savingsMilestoneEnabled: preferences.savingsMilestoneEnabled,
          debtMilestoneEnabled: preferences.debtMilestoneEnabled,
          weeklySummaryEnabled: preferences.weeklySummaryEnabled,
          weeklySummaryDay: preferences.weeklySummaryDay,
          monthlySummaryEnabled: preferences.monthlySummaryEnabled,
          monthlySummaryDay: preferences.monthlySummaryDay,
          pushNotificationsEnabled: preferences.pushNotificationsEnabled,
          emailNotificationsEnabled: preferences.emailNotificationsEnabled,
          emailAddress: preferences.emailAddress,
          quietHoursStart: preferences.quietHoursStart,
          quietHoursEnd: preferences.quietHoursEnd,
        }),
      });

      if (!response.ok) throw new Error('Failed to save preferences');

      const updated = await response.json();
      setPreferences(updated);
      toast.success('Preferences saved successfully');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin">
          <div className="h-8 w-8 border-4 border-border border-t-[var(--color-primary)] rounded-full" />
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <Card className="bg-background border-border">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Failed to load preferences</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Push Notifications */}
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle>Push Notifications</CardTitle>
          <CardDescription className="text-muted-foreground">
            Control how and where you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="push-enabled" className="text-muted-foreground">
              Enable push notifications
            </Label>
            <Switch
              id="push-enabled"
              checked={preferences.pushNotificationsEnabled}
              onCheckedChange={(value) =>
                setPreferences({
                  ...preferences,
                  pushNotificationsEnabled: value,
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="email-enabled" className="text-muted-foreground">
              Enable email notifications
            </Label>
            <Switch
              id="email-enabled"
              checked={preferences.emailNotificationsEnabled}
              onCheckedChange={(value) =>
                setPreferences({
                  ...preferences,
                  emailNotificationsEnabled: value,
                })
              }
            />
          </div>

          {preferences.emailNotificationsEnabled && (
            <div>
              <Label htmlFor="email" className="text-muted-foreground block mb-2">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={preferences.emailAddress || ''}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    emailAddress: e.target.value,
                  })
                }
                placeholder="you@example.com"
                className="bg-card border-border text-foreground"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bill Reminders */}
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle>Bill Reminders</CardTitle>
          <CardDescription className="text-muted-foreground">
            Get reminded about upcoming bill payments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="bill-reminder" className="text-muted-foreground">
              Enable bill reminders
            </Label>
            <Switch
              id="bill-reminder"
              checked={preferences.billReminderEnabled}
              onCheckedChange={(value) =>
                setPreferences({
                  ...preferences,
                  billReminderEnabled: value,
                })
              }
            />
          </div>

          {preferences.billReminderEnabled && (
            <>
              <div>
                <Label htmlFor="days-before" className="text-muted-foreground block mb-2">
                  Days before due date
                </Label>
                <Input
                  id="days-before"
                  type="number"
                  min="1"
                  max="30"
                  value={preferences.billReminderDaysBefore}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      billReminderDaysBefore: parseInt(e.target.value, 10),
                    })
                  }
                  className="bg-card border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  You'll receive a reminder {preferences.billReminderDaysBefore} day
                  {preferences.billReminderDaysBefore !== 1 ? 's' : ''} before each bill is due
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="bill-due-date" className="text-muted-foreground">
                  Remind on due date
                </Label>
                <Switch
                  id="bill-due-date"
                  checked={preferences.billReminderOnDueDate}
                  onCheckedChange={(value) =>
                    setPreferences({
                      ...preferences,
                      billReminderOnDueDate: value,
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="bill-overdue" className="text-muted-foreground">
                  Remind for overdue bills
                </Label>
                <Switch
                  id="bill-overdue"
                  checked={preferences.billOverdueReminder}
                  onCheckedChange={(value) =>
                    setPreferences({
                      ...preferences,
                      billOverdueReminder: value,
                    })
                  }
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Budget Alerts */}
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle>Budget Alerts</CardTitle>
          <CardDescription className="text-muted-foreground">
            Get notified about budget warnings and limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="budget-warning" className="text-muted-foreground">
              Enable budget warnings
            </Label>
            <Switch
              id="budget-warning"
              checked={preferences.budgetWarningEnabled}
              onCheckedChange={(value) =>
                setPreferences({
                  ...preferences,
                  budgetWarningEnabled: value,
                })
              }
            />
          </div>

          {preferences.budgetWarningEnabled && (
            <div>
              <Label htmlFor="warning-threshold" className="text-muted-foreground block mb-2">
                Warning threshold
              </Label>
              <Input
                id="warning-threshold"
                type="number"
                min="0"
                max="100"
                value={preferences.budgetWarningThreshold}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    budgetWarningThreshold: parseInt(e.target.value, 10),
                  })
                }
                className="bg-card border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">
                You'll be warned when spending reaches {preferences.budgetWarningThreshold}%
                of your budget
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="budget-exceeded" className="text-muted-foreground">
              Budget exceeded alerts
            </Label>
            <Switch
              id="budget-exceeded"
              checked={preferences.budgetExceededAlert}
              onCheckedChange={(value) =>
                setPreferences({
                  ...preferences,
                  budgetExceededAlert: value,
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Low Balance Alerts */}
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle>Low Balance Alerts</CardTitle>
          <CardDescription className="text-muted-foreground">
            Get notified when account balance drops below threshold
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="low-balance" className="text-muted-foreground">
              Enable low balance alerts
            </Label>
            <Switch
              id="low-balance"
              checked={preferences.lowBalanceAlertEnabled}
              onCheckedChange={(value) =>
                setPreferences({
                  ...preferences,
                  lowBalanceAlertEnabled: value,
                })
              }
            />
          </div>

          {preferences.lowBalanceAlertEnabled && (
            <div>
              <Label htmlFor="balance-threshold" className="text-muted-foreground block mb-2">
                Alert threshold ($)
              </Label>
              <Input
                id="balance-threshold"
                type="number"
                min="0"
                step="0.01"
                value={preferences.lowBalanceThreshold}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    lowBalanceThreshold: parseFloat(e.target.value),
                  })
                }
                className="bg-card border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">
                You'll be alerted when balance drops below $
                {preferences.lowBalanceThreshold.toFixed(2)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goals & Milestones */}
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle>Goals & Milestones</CardTitle>
          <CardDescription className="text-muted-foreground">
            Get notified when you reach financial milestones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="savings-milestone" className="text-muted-foreground">
              Savings milestone notifications
            </Label>
            <Switch
              id="savings-milestone"
              checked={preferences.savingsMilestoneEnabled}
              onCheckedChange={(value) =>
                setPreferences({
                  ...preferences,
                  savingsMilestoneEnabled: value,
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="debt-milestone" className="text-muted-foreground">
              Debt payoff milestone notifications
            </Label>
            <Switch
              id="debt-milestone"
              checked={preferences.debtMilestoneEnabled}
              onCheckedChange={(value) =>
                setPreferences({
                  ...preferences,
                  debtMilestoneEnabled: value,
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Reports */}
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle>Summary Reports</CardTitle>
          <CardDescription className="text-muted-foreground">
            Regular spending summaries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="weekly-summary" className="text-muted-foreground">
              Weekly summary
            </Label>
            <Switch
              id="weekly-summary"
              checked={preferences.weeklySummaryEnabled}
              onCheckedChange={(value) =>
                setPreferences({
                  ...preferences,
                  weeklySummaryEnabled: value,
                })
              }
            />
          </div>

          {preferences.weeklySummaryEnabled && (
            <div>
              <Label htmlFor="weekly-day" className="text-muted-foreground block mb-2">
                Day to send
              </Label>
              <select
                id="weekly-day"
                value={preferences.weeklySummaryDay}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    weeklySummaryDay: e.target.value,
                  })
                }
                className="w-full bg-card border border-border text-foreground rounded px-3 py-2"
              >
                <option value="sunday">Sunday</option>
                <option value="monday">Monday</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday</option>
                <option value="saturday">Saturday</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="monthly-summary" className="text-muted-foreground">
              Monthly summary
            </Label>
            <Switch
              id="monthly-summary"
              checked={preferences.monthlySummaryEnabled}
              onCheckedChange={(value) =>
                setPreferences({
                  ...preferences,
                  monthlySummaryEnabled: value,
                })
              }
            />
          </div>

          {preferences.monthlySummaryEnabled && (
            <div>
              <Label htmlFor="monthly-day" className="text-muted-foreground block mb-2">
                Day of month
              </Label>
              <Input
                id="monthly-day"
                type="number"
                min="1"
                max="31"
                value={preferences.monthlySummaryDay}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    monthlySummaryDay: parseInt(e.target.value, 10),
                  })
                }
                className="bg-card border-border text-foreground"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[var(--color-primary)] hover:opacity-90 text-white"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
        <Button
          onClick={fetchPreferences}
          variant="outline"
          className="border-border text-muted-foreground hover:text-foreground"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
