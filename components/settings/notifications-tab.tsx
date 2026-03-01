'use client';

import { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Receipt, AlertTriangle, Wallet, Target, Calendar,
  Bell, Mail, Loader2, AlertCircle, CreditCard, TrendingUp,
  ChevronDown,
} from 'lucide-react';
import { useHousehold } from '@/contexts/household-context';

type NotificationChannel = 'push' | 'email';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PreferenceValue = any;

const CHANNELS: Array<{
  id: NotificationChannel;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  available: boolean;
  description: string;
}> = [
  { id: 'push',  label: 'Push',  icon: Bell, available: true,  description: 'Browser notifications' },
  { id: 'email', label: 'Email', icon: Mail, available: false, description: 'Coming soon'           },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  label,
  accent = 'var(--color-primary)',
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 55%, transparent)', borderLeft: `3px solid ${accent}` }}>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent, opacity: 0.85 }} />}
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: accent }}>{label}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function NotifRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  channelField,
  parseChannels,
  preferences,
  toggleChannel,
  expandChildren,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  channelField?: string;
  parseChannels: (s: string | null | undefined) => NotificationChannel[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  preferences: any;
  toggleChannel: (field: string, ch: NotificationChannel) => void;
  expandChildren?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 45%, transparent)' }}>
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <Label htmlFor={id} className="text-[13px] font-medium cursor-pointer" style={{ color: 'var(--color-foreground)' }}>{label}</Label>
          {description && <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>{description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
          {(channelField || expandChildren) && (
            <button
              onClick={() => setOpen(o => !o)}
              className="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
              style={{ color: 'var(--color-muted-foreground)', backgroundColor: 'transparent' }}
              aria-label="Toggle details"
            >
              <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="px-4 pb-3 space-y-2">
          {channelField && preferences && (
            <div className="pl-3 border-l-2 space-y-1.5" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Delivery channels</p>
              <div className="flex gap-2">
                {CHANNELS.map(ch => {
                  const selected = parseChannels(preferences[channelField]).includes(ch.id);
                  return (
                    <div key={ch.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                      <Checkbox
                        id={`${channelField}-${ch.id}`}
                        checked={selected}
                        onCheckedChange={() => toggleChannel(channelField, ch.id)}
                        disabled={!checked || !ch.available}
                        aria-label={`Toggle ${ch.label}`}
                      />
                      <ch.icon className="w-3 h-3" style={{ color: 'var(--color-muted-foreground)' }} />
                      <Label htmlFor={`${channelField}-${ch.id}`} className="text-[11px] cursor-pointer" style={{ opacity: !checked || !ch.available ? 0.5 : 1, color: 'var(--color-foreground)' }}>
                        {ch.label}
                      </Label>
                      {!ch.available && <span className="text-[10px]" style={{ color: 'var(--color-warning)' }}>Soon</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {expandChildren}
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationsTab() {
  const { preferences, preferencesLoading, refreshPreferences, selectedHousehold } = useHousehold();
  const [isSaving, setIsSaving] = useState(false);

  const parseChannels = (s: string | null | undefined): NotificationChannel[] => {
    if (!s) return ['push'];
    try { return JSON.parse(s); } catch { return ['push']; }
  };

  const updatePreference = useCallback(
    async (key: string, value: PreferenceValue) => {
      if (!selectedHousehold || !preferences) return;
      setIsSaving(true);
      try {
        const res = await fetch(`/api/user/households/${selectedHousehold.id}/preferences`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ [key]: value }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
        await refreshPreferences();
        toast.success('Preference updated');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to update preference');
      } finally {
        setIsSaving(false);
      }
    },
    [selectedHousehold, preferences, refreshPreferences]
  );

  const toggleChannel = useCallback(
    (channelField: string, channel: NotificationChannel) => {
      if (!preferences) return;
      const current = parseChannels(preferences[channelField as keyof typeof preferences] as string);
      const next = current.includes(channel) ? current.filter(c => c !== channel) : [...current, channel];
      if (next.length === 0) { toast.error('At least one channel must be selected'); return; }
      updatePreference(channelField, JSON.stringify(next));
    },
    [preferences, updatePreference]
  );

  if (preferencesLoading || !selectedHousehold) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="rounded-xl py-12 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
        <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--color-destructive)' }} />
        <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>Failed to load preferences</p>
        <button onClick={refreshPreferences} className="text-[12px] px-4 py-2 rounded-lg mt-2" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>Retry</button>
      </div>
    );
  }

  const sharedRowProps = { parseChannels, preferences, toggleChannel };

  return (
    <div className="space-y-4">

      {/* Saving indicator */}
      {isSaving && (
        <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
        </div>
      )}

      {/* ── Bills ─────────────────────────────────────────────────────── */}
      <Section icon={Receipt} label="Bill Reminders">
        <NotifRow
          id="bill-reminder-enabled"
          label="Bill reminders"
          description="Get notified when bills are due."
          checked={preferences.billRemindersEnabled}
          onCheckedChange={v => updatePreference('billRemindersEnabled', v)}
          channelField="billRemindersChannels"
          {...sharedRowProps}
        />
      </Section>

      {/* ── Budget ────────────────────────────────────────────────────── */}
      <Section icon={AlertTriangle} label="Budget Alerts" accent="var(--color-warning)">
        <NotifRow
          id="budget-warning-enabled"
          label="Budget warnings"
          description="Get notified when approaching budget limits."
          checked={preferences.budgetWarningsEnabled}
          onCheckedChange={v => updatePreference('budgetWarningsEnabled', v)}
          channelField="budgetWarningsChannels"
          {...sharedRowProps}
        />
        <NotifRow
          id="budget-exceeded"
          label="Budget exceeded alerts"
          description="Immediate notification when you go over budget."
          checked={preferences.budgetExceededEnabled}
          onCheckedChange={v => updatePreference('budgetExceededEnabled', v)}
          channelField="budgetExceededChannels"
          {...sharedRowProps}
        />
        <NotifRow
          id="budget-review"
          label="Monthly budget reviews"
          description="Summary of your budget performance each month."
          checked={preferences.budgetReviewEnabled}
          onCheckedChange={v => updatePreference('budgetReviewEnabled', v)}
          channelField="budgetReviewChannels"
          {...sharedRowProps}
        />
      </Section>

      {/* ── Accounts ──────────────────────────────────────────────────── */}
      <Section icon={Wallet} label="Account Alerts">
        <NotifRow
          id="low-balance-enabled"
          label="Low balance alerts"
          description="Get notified when balances fall below your threshold."
          checked={preferences.lowBalanceEnabled}
          onCheckedChange={v => updatePreference('lowBalanceEnabled', v)}
          channelField="lowBalanceChannels"
          {...sharedRowProps}
        />
      </Section>

      {/* ── Income ────────────────────────────────────────────────────── */}
      <Section icon={TrendingUp} label="Income Alerts" accent="var(--color-income)">
        <NotifRow
          id="income-late-enabled"
          label="Late income alerts"
          description="Get notified when expected recurring income hasn't arrived."
          checked={preferences.incomeLateEnabled}
          onCheckedChange={v => updatePreference('incomeLateEnabled', v)}
          channelField="incomeLateChannels"
          {...sharedRowProps}
        />
      </Section>

      {/* ── Credit ────────────────────────────────────────────────────── */}
      <Section icon={CreditCard} label="Credit Utilization" accent="var(--color-warning)">
        <NotifRow
          id="high-utilization-enabled"
          label="High utilization warnings"
          description="Get notified when credit utilization exceeds your threshold."
          checked={preferences.highUtilizationEnabled}
          onCheckedChange={v => updatePreference('highUtilizationEnabled', v)}
          channelField="highUtilizationChannels"
          expandChildren={
            preferences.highUtilizationEnabled ? (
              <div className="pl-3 border-l-2 space-y-1.5" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Alert threshold</p>
                <Select value={String(preferences.highUtilizationThreshold || 75)} onValueChange={v => updatePreference('highUtilizationThreshold', parseInt(v))}>
                  <SelectTrigger id="high-utilization-threshold" name="high-utilization-threshold" className="h-8 w-48 text-[12px]" aria-label="Select utilization threshold" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30% — Early warning</SelectItem>
                    <SelectItem value="50">50% — Moderate usage</SelectItem>
                    <SelectItem value="75">75% — High usage</SelectItem>
                    <SelectItem value="90">90% — Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : undefined
          }
          {...sharedRowProps}
        />
        <NotifRow
          id="credit-limit-change"
          label="Credit limit changes"
          description="Get notified when your credit limit increases or decreases."
          checked={preferences.creditLimitChangeEnabled}
          onCheckedChange={v => updatePreference('creditLimitChangeEnabled', v)}
          channelField="creditLimitChangeChannels"
          {...sharedRowProps}
        />
      </Section>

      {/* ── Goals & Debts ─────────────────────────────────────────────── */}
      <Section icon={Target} label="Goals & Debts" accent="var(--color-success)">
        <NotifRow
          id="savings-milestones"
          label="Savings goal milestones"
          description="Get notified at 25%, 50%, 75%, and 100% of your goals."
          checked={preferences.savingsMilestonesEnabled}
          onCheckedChange={v => updatePreference('savingsMilestonesEnabled', v)}
          channelField="savingsMilestonesChannels"
          {...sharedRowProps}
        />
        <NotifRow
          id="debt-milestones"
          label="Debt payoff milestones"
          description="Get notified at key milestones as you pay down debts."
          checked={preferences.debtMilestonesEnabled}
          onCheckedChange={v => updatePreference('debtMilestonesEnabled', v)}
          channelField="debtMilestonesChannels"
          {...sharedRowProps}
        />
      </Section>

      {/* ── Summary Reports ───────────────────────────────────────────── */}
      <Section icon={Calendar} label="Summary Reports">
        <NotifRow
          id="weekly-summary"
          label="Weekly summary"
          description="A weekly overview of your financial activity."
          checked={preferences.weeklySummariesEnabled}
          onCheckedChange={v => updatePreference('weeklySummariesEnabled', v)}
          channelField="weeklySummariesChannels"
          {...sharedRowProps}
        />
        <NotifRow
          id="monthly-summary"
          label="Monthly summary"
          description="A monthly overview of your financial activity."
          checked={preferences.monthlySummariesEnabled}
          onCheckedChange={v => updatePreference('monthlySummariesEnabled', v)}
          channelField="monthlySummariesChannels"
          {...sharedRowProps}
        />
      </Section>
    </div>
  );
}
