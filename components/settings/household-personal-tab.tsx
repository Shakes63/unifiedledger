'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, Loader2, Palette, DollarSign, Calendar, HelpCircle, CheckCircle2 } from 'lucide-react';
import { type Theme } from '@/lib/themes/theme-config';
import { getAllThemes, getTheme, applyTheme } from '@/lib/themes/theme-utils';
import { toast } from 'sonner';
import { useHousehold } from '@/contexts/household-context';
import { toLocalDateString } from '@/lib/utils/local-date';

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

interface HouseholdPersonalTabProps {
  householdId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  label,
  accent = 'var(--color-primary)',
  footer,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  accent?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 55%, transparent)', borderLeft: `3px solid ${accent}` }}>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent, opacity: 0.85 }} />}
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: accent }}>{label}</span>
      </div>
      <div className="px-4 py-4 space-y-4">{children}</div>
      {footer && (
        <div className="px-4 py-3 flex items-center justify-end gap-2" style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 35%, transparent)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

function Field({ label, helper, id, children }: { label: string; helper?: string; id?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {id
        ? <Label htmlFor={id} className="text-[11px] font-medium uppercase tracking-wide block" style={{ color: 'var(--color-muted-foreground)' }}>{label}</Label>
        : <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>{label}</p>
      }
      {children}
      {helper && <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.75 }}>{helper}</p>}
    </div>
  );
}

function SwitchRow({ label, description, id, checked, onCheckedChange }: { label: string; description?: string; id: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="flex-1 min-w-0">
        <Label htmlFor={id} className="text-[13px] font-medium cursor-pointer" style={{ color: 'var(--color-foreground)' }}>{label}</Label>
        {description && <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HouseholdPersonalTab({ householdId }: HouseholdPersonalTabProps) {
  const { selectedHousehold, preferences, preferencesLoading, refreshPreferences } = useHousehold();
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [currentThemeId, setCurrentThemeId] = useState<string>('dark-green');
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('dark-green');

  const [financialSettings, setFinancialSettings] = useState({
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
  });
  const [currentPeriod, setCurrentPeriod] = useState<PeriodInfo | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const allThemes = getAllThemes();

  const parseSemiMonthlyDays = (jsonStr: string): [number, number] => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length >= 2) return [parsed[0], parsed[1]];
    } catch { /* fallthrough */ }
    return [1, 15];
  };

  const fetchSchedule = useCallback(async () => {
    try {
      setScheduleLoading(true);
      const res = await fetch(`/api/budget-schedule?householdId=${householdId}`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setScheduleSettings(d.settings);
        setCurrentPeriod(d.currentPeriod);
      }
    } catch { toast.error('Failed to load budget schedule'); }
    finally { setScheduleLoading(false); }
  }, [householdId]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  useEffect(() => {
    if (!preferences) return;
    if (preferences.theme) {
      setCurrentThemeId(preferences.theme);
      setSelectedThemeId(preferences.theme);
      setCurrentTheme(getTheme(preferences.theme));
    }
    setFinancialSettings({
      showCents: preferences.showCents !== false,
      negativeNumberFormat: preferences.negativeNumberFormat || '-$100',
      defaultTransactionType: preferences.defaultTransactionType || 'expense',
      combinedTransferView: preferences.combinedTransferView !== false,
    });
  }, [preferences]);

  useEffect(() => {
    setCurrentTheme(getTheme(currentThemeId));
  }, [currentThemeId]);

  const handleThemeSelect = (themeId: string) => {
    const theme = getTheme(themeId);
    if (!theme || !theme.isAvailable) { toast.error('This theme is not available yet'); return; }
    setSelectedThemeId(themeId);
  };

  const handleSaveTheme = async () => {
    if (selectedThemeId === currentThemeId) { toast.info('This theme is already active'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/user/households/${householdId}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: selectedThemeId }),
      });
      if (res.ok) {
        setCurrentThemeId(selectedThemeId);
        toast.success('Theme applied!');
        applyTheme(selectedThemeId, { householdId });
        await refreshPreferences();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to update theme');
      }
    } catch { toast.error('Failed to save theme'); }
    finally { setSaving(false); }
  };

  const handleSaveFinancial = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/user/households/${householdId}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(financialSettings),
      });
      if (res.ok) {
        toast.success('Financial settings saved');
        await refreshPreferences();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to save');
      }
    } catch { toast.error('Failed to save financial settings'); }
    finally { setSaving(false); }
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const res = await fetch('/api/budget-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ householdId, ...scheduleSettings }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      const d = await res.json();
      setCurrentPeriod(d.currentPeriod);
      toast.success('Budget schedule saved');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save budget schedule'); }
    finally { setSavingSchedule(false); }
  };

  const handleFrequencyChange = (frequency: BudgetCycleFrequency) => {
    const updated = { ...scheduleSettings, budgetCycleFrequency: frequency };
    if (frequency === 'weekly' || frequency === 'biweekly') {
      if (scheduleSettings.budgetCycleStartDay === null) updated.budgetCycleStartDay = 5;
      if (frequency === 'biweekly' && !scheduleSettings.budgetCycleReferenceDate) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
        const nextFriday = new Date(today);
        nextFriday.setDate(today.getDate() + daysUntilFriday);
        updated.budgetCycleReferenceDate = toLocalDateString(nextFriday);
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
    if (newDays[0] >= newDays[1]) {
      if (index === 0) newDays[1] = Math.min(31, newDays[0] + 1);
      else newDays[0] = Math.max(1, newDays[1] - 1);
    }
    setScheduleSettings({ ...scheduleSettings, budgetCycleSemiMonthlyDays: JSON.stringify(newDays) });
  };

  if (scheduleLoading || preferencesLoading || !currentTheme || !preferences) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', height: 180, animationDelay: `${i * 100}ms` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Theme ────────────────────────────────────────────────────── */}
      <Section
        icon={Palette}
        label="Theme"
        footer={
          selectedThemeId !== currentThemeId ? (
            <Button onClick={handleSaveTheme} disabled={saving} size="sm" className="text-[12px] h-8 px-4 font-medium" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Applying…</> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Apply Theme</>}
            </Button>
          ) : undefined
        }
      >
        {/* Current theme banner */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
          <span
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}
          >
            <Check className="w-2.5 h-2.5" /> Active
          </span>
          <span className="text-[13px] font-semibold" style={{ color: 'var(--color-foreground)' }}>{currentTheme.name}</span>
          <span className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>{currentTheme.description}</span>
        </div>

        {/* Theme grid */}
        <div className="grid grid-cols-2 gap-2">
          {allThemes.map(theme => {
            const isSelected = selectedThemeId === theme.id;
            const isCurrent  = currentThemeId  === theme.id;
            const isAvailable = theme.isAvailable;
            return (
              <button
                key={theme.id}
                onClick={() => isAvailable && handleThemeSelect(theme.id)}
                className="relative text-left rounded-lg px-3 py-2.5 transition-colors"
                style={{
                  border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  backgroundColor: isSelected ? 'color-mix(in oklch, var(--color-primary) 8%, transparent)' : 'var(--color-elevated)',
                  opacity: !isAvailable ? 0.5 : 1,
                  cursor: !isAvailable ? 'not-allowed' : 'pointer',
                }}
              >
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--color-foreground)' }}>{theme.name}</p>
                  {isCurrent && <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}>Active</span>}
                  {isSelected && !isCurrent && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />}
                </div>
                <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>{theme.description}</p>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Financial Display ────────────────────────────────────────── */}
      <Section
        icon={DollarSign}
        label="Financial Display"
        footer={
          <Button onClick={handleSaveFinancial} disabled={saving} size="sm" className="text-[12px] h-8 px-4 font-medium" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Save Display Settings</>}
          </Button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Amount Display" id="showCents">
            <Select value={financialSettings.showCents ? 'show' : 'hide'} onValueChange={v => setFinancialSettings({ ...financialSettings, showCents: v === 'show' })}>
              <SelectTrigger id="showCents" name="showCents" aria-label="Select whether to show cents" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="show">Show Cents ($100.50)</SelectItem>
                <SelectItem value="hide">Hide Cents ($100)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Negative Format" id="negativeFormat">
            <Select value={financialSettings.negativeNumberFormat} onValueChange={v => setFinancialSettings({ ...financialSettings, negativeNumberFormat: v })}>
              <SelectTrigger id="negativeFormat" name="negativeFormat" aria-label="Select negative number format" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-$100">-$100</SelectItem>
                <SelectItem value="($100)">($100)</SelectItem>
                <SelectItem value="$100-">$100-</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Default Transaction Type" id="defaultTransactionType">
            <Select value={financialSettings.defaultTransactionType} onValueChange={v => setFinancialSettings({ ...financialSettings, defaultTransactionType: v })}>
              <SelectTrigger id="defaultTransactionType" name="defaultTransactionType" aria-label="Select default transaction type" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <SwitchRow
          id="combinedTransferView"
          label="Combined Transfer View"
          description="Show transfers as single entries or display both sides separately."
          checked={financialSettings.combinedTransferView}
          onCheckedChange={v => setFinancialSettings({ ...financialSettings, combinedTransferView: v })}
        />
      </Section>

      {/* ── Budget Schedule ─────────────────────────────────────────── */}
      <Section
        icon={Calendar}
        label="Budget Schedule"
        footer={
          <Button onClick={handleSaveSchedule} disabled={savingSchedule} size="sm" className="text-[12px] h-8 px-4 font-medium" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
            {savingSchedule ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Save Schedule</>}
          </Button>
        }
      >
        {/* Current period card */}
        {currentPeriod && (
          <div className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 6%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
            <div>
              <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>Current Budget Period</p>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--color-foreground)' }}>{currentPeriod.label}</p>
              <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>{currentPeriod.start} – {currentPeriod.end}</p>
            </div>
            <div className="text-right">
              <p className="text-[24px] font-bold font-mono tabular-nums" style={{ color: 'var(--color-primary)' }}>{currentPeriod.daysRemaining}</p>
              <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>days left</p>
            </div>
          </div>
        )}

        <Field label="Budget Cycle" id="budgetCycleFrequency" helper={
          scheduleSettings.budgetCycleFrequency === 'weekly'     ? 'Budget resets every week.' :
          scheduleSettings.budgetCycleFrequency === 'biweekly'   ? 'Budget resets every other week.' :
          scheduleSettings.budgetCycleFrequency === 'semi-monthly' ? 'Budget resets twice a month on specific days.' :
          'Budget resets at the start of each month.'
        }>
          <div className="flex items-center gap-2">
            <Select value={scheduleSettings.budgetCycleFrequency} onValueChange={v => handleFrequencyChange(v as BudgetCycleFrequency)}>
              <SelectTrigger id="budgetCycleFrequency" name="budgetCycleFrequency" aria-label="Select budget cycle frequency" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Every 2 Weeks (Biweekly)</SelectItem>
                <SelectItem value="semi-monthly">Twice a Month (1st &amp; 15th, etc.)</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button style={{ color: 'var(--color-muted-foreground)' }}><HelpCircle className="w-4 h-4" /></button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-[12px]">
                  Choose how often you want to budget. Your monthly budget will be divided into these periods.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </Field>

        {/* Start day (weekly / biweekly) */}
        {(scheduleSettings.budgetCycleFrequency === 'weekly' || scheduleSettings.budgetCycleFrequency === 'biweekly') && (
          <Field label="Start Day" id="budgetCycleStartDay" helper={`Budget period starts on this day each ${scheduleSettings.budgetCycleFrequency === 'weekly' ? 'week' : 'two weeks'}.`}>
            <Select value={String(scheduleSettings.budgetCycleStartDay ?? 5)} onValueChange={v => setScheduleSettings({ ...scheduleSettings, budgetCycleStartDay: parseInt(v) })}>
              <SelectTrigger id="budgetCycleStartDay" name="budgetCycleStartDay" aria-label="Select budget cycle start day" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((day, i) => <SelectItem key={i} value={String(i)}>{day}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        )}

        {/* Reference date (biweekly) */}
        {scheduleSettings.budgetCycleFrequency === 'biweekly' && (
          <Field label="Reference Date" id="budgetCycleReferenceDate" helper="A known date when your cycle starts (e.g., your next payday).">
            <div className="flex items-center gap-2">
              <Input
                id="budgetCycleReferenceDate"
                type="date"
                value={scheduleSettings.budgetCycleReferenceDate || ''}
                onChange={e => setScheduleSettings({ ...scheduleSettings, budgetCycleReferenceDate: e.target.value })}
                className="h-9 text-[13px]"
                style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button style={{ color: 'var(--color-muted-foreground)' }}><HelpCircle className="w-4 h-4" /></button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-[12px]">
                    Pick a date when your cycle starts (like your next payday). This helps us know which weeks are &quot;on&quot; and &quot;off&quot;.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </Field>
        )}

        {/* Semi-monthly days */}
        {scheduleSettings.budgetCycleFrequency === 'semi-monthly' && (
          <Field label="Budget Reset Days" helper="Common: 1st & 15th, 5th & 20th, or match your pay schedule.">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="semiMonthlyDay1" className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>First Period Starts</Label>
                <Select value={String(parseSemiMonthlyDays(scheduleSettings.budgetCycleSemiMonthlyDays)[0])} onValueChange={v => handleSemiMonthlyDayChange(0, parseInt(v))}>
                  <SelectTrigger id="semiMonthlyDay1" name="semiMonthlyDay1" aria-label="Select first semi-monthly day" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                      <SelectItem key={d} value={String(d)}>{d}{d===1?'st':d===2?'nd':d===3?'rd':'th'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="semiMonthlyDay2" className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Second Period Starts</Label>
                <Select value={String(parseSemiMonthlyDays(scheduleSettings.budgetCycleSemiMonthlyDays)[1])} onValueChange={v => handleSemiMonthlyDayChange(1, parseInt(v))}>
                  <SelectTrigger id="semiMonthlyDay2" name="semiMonthlyDay2" aria-label="Select second semi-monthly day" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                      <SelectItem key={d} value={String(d)}>{d}{d===1?'st':d===2?'nd':d===3?'rd':'th'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Field>
        )}
      </Section>

      {/* Personal context note */}
      <p className="text-[11px] px-1" style={{ color: 'var(--color-muted-foreground)', opacity: 0.7 }}>
        These preferences are personal to you within{' '}
        <span style={{ color: 'var(--color-foreground)', opacity: 1 }}>{selectedHousehold?.name || 'this household'}</span>{' '}
        and are not visible to other members.
      </p>
    </div>
  );
}
