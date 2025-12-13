'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, Calendar, HelpCircle } from 'lucide-react';
import { useHousehold } from '@/contexts/household-context';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type BudgetCycleFrequency = 'weekly' | 'biweekly' | 'semi-monthly' | 'monthly';

interface FinancialSettings {
  showCents: boolean;
  negativeNumberFormat: string;
  defaultTransactionType: string;
  combinedTransferView: boolean;
}

interface BudgetScheduleSettings {
  budgetCycleFrequency: BudgetCycleFrequency;
  budgetCycleStartDay: number | null;
  budgetCycleReferenceDate: string | null;
  budgetCycleSemiMonthlyDays: string;
  budgetPeriodRollover: boolean;
  budgetPeriodManualAmount: number | null;
}

interface PeriodInfo {
  start: string;
  end: string;
  label: string;
  daysRemaining: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function FinancialTab() {
  const { selectedHouseholdId } = useHousehold();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [settings, setSettings] = useState<FinancialSettings>({
    showCents: true,
    negativeNumberFormat: '-$100',
    defaultTransactionType: 'expense',
    combinedTransferView: true,
  });
  const [scheduleSettings, setScheduleSettings] = useState<BudgetScheduleSettings>({
    budgetCycleFrequency: 'monthly',
    budgetCycleStartDay: null,
    budgetCycleReferenceDate: null,
    budgetCycleSemiMonthlyDays: '[1, 15]',
    budgetPeriodRollover: false,
    budgetPeriodManualAmount: null,
  });
  const [currentPeriod, setCurrentPeriod] = useState<PeriodInfo | null>(null);

  // Parse semi-monthly days from JSON string
  const parseSemiMonthlyDays = (jsonStr: string): [number, number] => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        return [parsed[0], parsed[1]];
      }
    } catch {
      // Fall through
    }
    return [1, 15];
  };

  const fetchSettings = async () => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch both financial settings and budget schedule in parallel
      const [prefsResponse, scheduleResponse] = await Promise.all([
        fetch(`/api/user/households/${selectedHouseholdId}/preferences`, { credentials: 'include' }),
        fetch(`/api/budget-schedule?householdId=${selectedHouseholdId}`, { credentials: 'include' }),
      ]);

      if (prefsResponse.ok) {
        const data = await prefsResponse.json();
        setSettings({
          showCents: data.showCents !== false,
          negativeNumberFormat: data.negativeNumberFormat || '-$100',
          defaultTransactionType: data.defaultTransactionType || 'expense',
          combinedTransferView: data.combinedTransferView !== false,
        });
      }

      if (scheduleResponse.ok) {
        const scheduleData = await scheduleResponse.json();
        setScheduleSettings(scheduleData.settings);
        setCurrentPeriod(scheduleData.currentPeriod);
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

  const handleSaveSchedule = async () => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return;
    }

    setSavingSchedule(true);
    try {
      const response = await fetch('/api/budget-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          householdId: selectedHouseholdId,
          ...scheduleSettings,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save budget schedule');
      }

      const data = await response.json();
      setCurrentPeriod(data.currentPeriod);
      toast.success('Budget schedule saved successfully');
    } catch (error) {
      console.error('Error saving budget schedule:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save budget schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleFrequencyChange = (frequency: BudgetCycleFrequency) => {
    const updated = { ...scheduleSettings, budgetCycleFrequency: frequency };
    
    // Set sensible defaults based on frequency
    if (frequency === 'weekly' || frequency === 'biweekly') {
      if (scheduleSettings.budgetCycleStartDay === null) {
        updated.budgetCycleStartDay = 5; // Friday
      }
      if (frequency === 'biweekly' && !scheduleSettings.budgetCycleReferenceDate) {
        // Set reference to next Friday
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
        const nextFriday = new Date(today);
        nextFriday.setDate(today.getDate() + daysUntilFriday);
        updated.budgetCycleReferenceDate = nextFriday.toISOString().split('T')[0];
      }
    } else if (frequency === 'semi-monthly') {
      if (scheduleSettings.budgetCycleSemiMonthlyDays === '[1, 15]' || !scheduleSettings.budgetCycleSemiMonthlyDays) {
        updated.budgetCycleSemiMonthlyDays = '[1, 15]';
      }
    }
    
    setScheduleSettings(updated);
  };

  const handleSemiMonthlyDayChange = (index: 0 | 1, value: number) => {
    const [day1, day2] = parseSemiMonthlyDays(scheduleSettings.budgetCycleSemiMonthlyDays);
    const newDays = index === 0 ? [value, day2] : [day1, value];
    // Ensure first day is always less than second
    if (newDays[0] >= newDays[1]) {
      if (index === 0) {
        newDays[1] = Math.min(31, newDays[0] + 1);
      } else {
        newDays[0] = Math.max(1, newDays[1] - 1);
      }
    }
    setScheduleSettings({
      ...scheduleSettings,
      budgetCycleSemiMonthlyDays: JSON.stringify(newDays),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-(--color-primary)" />
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
            className="bg-(--color-primary) hover:bg-(--color-primary)/90"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Financial Settings
          </Button>
        </div>
      </div>

      {/* Budget Schedule Section */}
      <div className="border-t border-border pt-8 mt-8">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-(--color-primary)" />
            <h2 className="text-xl font-semibold text-foreground">Budget Schedule</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Set up your budget cycle to match your pay schedule or preferred budgeting period
          </p>
        </div>

        {/* Current Period Display */}
        {currentPeriod && (
          <div className="mb-6 p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Budget Period</p>
                <p className="text-lg font-semibold text-foreground">{currentPeriod.label}</p>
                <p className="text-sm text-muted-foreground">
                  {currentPeriod.start} to {currentPeriod.end}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-(--color-primary)">
                  {currentPeriod.daysRemaining}
                </p>
                <p className="text-sm text-muted-foreground">days remaining</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Budget Cycle Frequency */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="budgetCycleFrequency" className="text-foreground">
                Budget Cycle
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-sm">
                      Choose how often you want to budget. Your monthly budget will be divided into these periods.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select
              value={scheduleSettings.budgetCycleFrequency}
              onValueChange={(value) => handleFrequencyChange(value as BudgetCycleFrequency)}
            >
              <SelectTrigger
                id="budgetCycleFrequency"
                name="budgetCycleFrequency"
                aria-label="Select budget cycle frequency"
                className="bg-background border-border text-foreground"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Every 2 Weeks (Biweekly)</SelectItem>
                <SelectItem value="semi-monthly">Twice a Month (1st & 15th, etc.)</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {scheduleSettings.budgetCycleFrequency === 'weekly' && 'Budget resets every week'}
              {scheduleSettings.budgetCycleFrequency === 'biweekly' && 'Budget resets every other week (e.g., every other Friday)'}
              {scheduleSettings.budgetCycleFrequency === 'semi-monthly' && 'Budget resets twice a month on specific days'}
              {scheduleSettings.budgetCycleFrequency === 'monthly' && 'Budget resets at the start of each month'}
            </p>
          </div>

          {/* Day of Week Picker (for weekly/biweekly) */}
          {(scheduleSettings.budgetCycleFrequency === 'weekly' || scheduleSettings.budgetCycleFrequency === 'biweekly') && (
            <div className="space-y-2">
              <Label htmlFor="budgetCycleStartDay" className="text-foreground">
                Start Day
              </Label>
              <Select
                value={String(scheduleSettings.budgetCycleStartDay ?? 5)}
                onValueChange={(value) =>
                  setScheduleSettings({ ...scheduleSettings, budgetCycleStartDay: parseInt(value) })
                }
              >
                <SelectTrigger
                  id="budgetCycleStartDay"
                  name="budgetCycleStartDay"
                  aria-label="Select budget cycle start day"
                  className="bg-background border-border text-foreground"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((day, index) => (
                    <SelectItem key={index} value={String(index)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Your budget period starts on this day each {scheduleSettings.budgetCycleFrequency === 'weekly' ? 'week' : 'two weeks'}
              </p>
            </div>
          )}

          {/* Reference Date (for biweekly) */}
          {scheduleSettings.budgetCycleFrequency === 'biweekly' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="budgetCycleReferenceDate" className="text-foreground">
                  Reference Date
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-sm">
                        Pick a date when your cycle starts (like your next payday). This helps us know which weeks are &quot;on&quot; and which are &quot;off&quot;.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="budgetCycleReferenceDate"
                type="date"
                value={scheduleSettings.budgetCycleReferenceDate || ''}
                onChange={(e) =>
                  setScheduleSettings({ ...scheduleSettings, budgetCycleReferenceDate: e.target.value })
                }
                className="bg-background border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                A known date when your budget cycle starts (e.g., your next payday)
              </p>
            </div>
          )}

          {/* Semi-Monthly Days */}
          {scheduleSettings.budgetCycleFrequency === 'semi-monthly' && (
            <div className="space-y-2">
              <Label className="text-foreground">Budget Reset Days</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="semiMonthlyDay1" className="text-xs text-muted-foreground">
                    First Period Starts
                  </Label>
                  <Select
                    value={String(parseSemiMonthlyDays(scheduleSettings.budgetCycleSemiMonthlyDays)[0])}
                    onValueChange={(value) => handleSemiMonthlyDayChange(0, parseInt(value))}
                  >
                    <SelectTrigger
                      id="semiMonthlyDay1"
                      name="semiMonthlyDay1"
                      aria-label="Select first semi-monthly day"
                      className="bg-background border-border text-foreground"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={String(day)}>
                          {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="semiMonthlyDay2" className="text-xs text-muted-foreground">
                    Second Period Starts
                  </Label>
                  <Select
                    value={String(parseSemiMonthlyDays(scheduleSettings.budgetCycleSemiMonthlyDays)[1])}
                    onValueChange={(value) => handleSemiMonthlyDayChange(1, parseInt(value))}
                  >
                    <SelectTrigger
                      id="semiMonthlyDay2"
                      name="semiMonthlyDay2"
                      aria-label="Select second semi-monthly day"
                      className="bg-background border-border text-foreground"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={String(day)}>
                          {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Common options: 1st & 15th, 5th & 20th, or match your pay schedule
              </p>
            </div>
          )}

          {/* Period Rollover */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="budgetPeriodRollover" className="text-foreground">
                    Period Rollover
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-sm">
                          When enabled, unused budget from one period carries over to the next within the same month.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-muted-foreground">
                  Carry unused budget to the next period within the month
                </p>
              </div>
              <Switch
                id="budgetPeriodRollover"
                checked={scheduleSettings.budgetPeriodRollover}
                onCheckedChange={(checked) =>
                  setScheduleSettings({ ...scheduleSettings, budgetPeriodRollover: checked })
                }
              />
            </div>
          </div>

          {/* Manual Period Budget Override */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="budgetPeriodManualAmount" className="text-foreground">
                Manual Period Budget (Optional)
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-sm">
                      Override the auto-calculated period budget. Leave empty to automatically divide your monthly budget by the number of periods.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              id="budgetPeriodManualAmount"
              type="number"
              min="0"
              step="0.01"
              placeholder="Leave empty to auto-calculate"
              value={scheduleSettings.budgetPeriodManualAmount ?? ''}
              onChange={(e) =>
                setScheduleSettings({
                  ...scheduleSettings,
                  budgetPeriodManualAmount: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              className="bg-background border-border text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Set a specific amount for each budget period, or leave empty to divide monthly budget automatically
            </p>
          </div>

          {/* Save Schedule Button */}
          <div className="pt-4">
            <Button
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              className="bg-(--color-primary) hover:bg-(--color-primary)/90"
            >
              {savingSchedule && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Budget Schedule
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
