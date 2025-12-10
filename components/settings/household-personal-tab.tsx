'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, Loader2, Palette, DollarSign, Calendar, HelpCircle } from 'lucide-react';
import { type Theme } from '@/lib/themes/theme-config';
import { getAllThemes, getTheme, applyTheme } from '@/lib/themes/theme-utils';
import { toast } from 'sonner';
import { useHousehold } from '@/contexts/household-context';

type BudgetCycleFrequency = 'weekly' | 'biweekly' | 'semi-monthly' | 'monthly';

interface BudgetScheduleSettings {
  budgetCycleFrequency: BudgetCycleFrequency;
  budgetCycleStartDay: number | null;
  budgetCycleReferenceDate: string | null;
  budgetCycleSemiMonthlyDays: string;
}

interface PeriodInfo {
  start: string;
  end: string;
  label: string;
  daysRemaining: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// User household preferences shape - API returns flexible structure
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserHouseholdPreferences = Record<string, any>;

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
  
  // Preferences state (for loading indicator)
  const [preferences, setPreferences] = useState<UserHouseholdPreferences | null>(null);

  // Budget schedule state
  const [scheduleSettings, setScheduleSettings] = useState<BudgetScheduleSettings>({
    budgetCycleFrequency: 'monthly',
    budgetCycleStartDay: null,
    budgetCycleReferenceDate: null,
    budgetCycleSemiMonthlyDays: '[1, 15]',
  });
  const [currentPeriod, setCurrentPeriod] = useState<PeriodInfo | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const allThemes = getAllThemes();

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

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch preferences and budget schedule in parallel
      const [prefsResponse, scheduleResponse] = await Promise.all([
        fetch(`/api/user/households/${householdId}/preferences`, { credentials: 'include' }),
        fetch(`/api/budget-schedule?householdId=${householdId}`, { credentials: 'include' }),
      ]);

      if (prefsResponse.ok) {
        const data = await prefsResponse.json();
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

      if (scheduleResponse.ok) {
        const scheduleData = await scheduleResponse.json();
        setScheduleSettings(scheduleData.settings);
        setCurrentPeriod(scheduleData.currentPeriod);
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

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const response = await fetch('/api/budget-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          householdId,
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

      {/* Budget Schedule Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-lg font-semibold text-foreground">Budget Schedule</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Set up your budget cycle to match your pay schedule or preferred budgeting period
        </p>

        {/* Current Period Display */}
        {currentPeriod && (
          <Card className="mb-4 p-4 border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Budget Period</p>
                <p className="text-lg font-semibold text-foreground">{currentPeriod.label}</p>
                <p className="text-sm text-muted-foreground">
                  {currentPeriod.start} to {currentPeriod.end}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[var(--color-primary)]">
                  {currentPeriod.daysRemaining}
                </p>
                <p className="text-sm text-muted-foreground">days remaining</p>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6 border border-border bg-card">
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

            {/* Save Schedule Button */}
            <div className="pt-2">
              <Button
                onClick={handleSaveSchedule}
                disabled={savingSchedule}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
              >
                {savingSchedule && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Budget Schedule
              </Button>
            </div>
          </div>
        </Card>
      </div>

    </div>
  );
}

