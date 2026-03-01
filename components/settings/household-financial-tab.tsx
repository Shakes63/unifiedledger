'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
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
import { toast } from 'sonner';
import { Loader2, CreditCard, Calendar, ExternalLink, Info, CheckCircle2, DollarSign } from 'lucide-react';
import { useHousehold } from '@/contexts/household-context';
import Link from 'next/link';

interface HouseholdFinancialSettings {
  defaultBudgetMethod: string;
  autoCategorization: boolean;
}

interface DebtStrategySettings {
  debtStrategyEnabled: boolean;
  debtPayoffMethod: 'snowball' | 'avalanche';
  extraMonthlyPayment: number;
  paymentFrequency: 'weekly' | 'biweekly' | 'monthly';
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

export function HouseholdFinancialTab() {
  const { selectedHouseholdId } = useHousehold();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDebt, setSavingDebt] = useState(false);
  const [settings, setSettings] = useState<HouseholdFinancialSettings>({
    defaultBudgetMethod: 'monthly',
    autoCategorization: true,
  });
  const [debtSettings, setDebtSettings] = useState<DebtStrategySettings>({
    debtStrategyEnabled: false,
    debtPayoffMethod: 'avalanche',
    extraMonthlyPayment: 0,
    paymentFrequency: 'monthly',
  });

  const fetchSettings = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      const [userRes, hhRes] = await Promise.all([
        fetch('/api/user/settings', { credentials: 'include' }),
        fetch(`/api/households/${selectedHouseholdId}/settings`, { credentials: 'include' }),
      ]);
      if (userRes.ok) {
        const d = await userRes.json();
        setSettings({ defaultBudgetMethod: d.settings.defaultBudgetMethod || 'monthly', autoCategorization: d.settings.autoCategorization !== false });
      }
      if (hhRes.ok) {
        const d = await hhRes.json();
        setDebtSettings({
          debtStrategyEnabled: d.settings.debtStrategyEnabled ?? false,
          debtPayoffMethod:    d.settings.debtPayoffMethod    ?? 'avalanche',
          extraMonthlyPayment: d.settings.extraMonthlyPayment ?? 0,
          paymentFrequency:    d.settings.paymentFrequency    ?? 'monthly',
        });
      }
    } catch {
      toast.error('Failed to load financial settings');
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/user/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(settings) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Financial settings saved');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleSaveDebtStrategy = async () => {
    if (!selectedHouseholdId) return;
    setSavingDebt(true);
    try {
      const res = await fetch(`/api/households/${selectedHouseholdId}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(debtSettings) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Debt strategy saved');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save debt strategy'); }
    finally { setSavingDebt(false); }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-48 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', animationDelay: `${i * 100}ms` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Budget Settings ─────────────────────────────────────────────── */}
      <Section
        icon={DollarSign}
        label="Budget Settings"
        footer={
          <Button onClick={handleSave} disabled={saving} size="sm" className="text-[12px] h-8 px-4 font-medium" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Save Settings</>}
          </Button>
        }
      >
        <Field label="Default Budget Method" helper="Budgeting methodology used by all household members." id="budgetMethod">
          <Select value={settings.defaultBudgetMethod} onValueChange={v => setSettings({ ...settings, defaultBudgetMethod: v })}>
            <SelectTrigger id="budgetMethod" name="budgetMethod" aria-label="Select budget method" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly Budget</SelectItem>
              <SelectItem value="zero-based">Zero-Based Budget</SelectItem>
              <SelectItem value="50/30/20">50/30/20 Rule</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Auto-Categorization" helper="Automatically apply rules to new transactions for all members." id="autoCategorization">
          <Select value={settings.autoCategorization ? 'enabled' : 'disabled'} onValueChange={v => setSettings({ ...settings, autoCategorization: v === 'enabled' })}>
            <SelectTrigger id="autoCategorization" name="autoCategorization" aria-label="Select auto-categorization setting" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {/* Budget schedule note */}
        <div className="flex items-start gap-2.5 rounded-lg px-3 py-2.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 6%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
          <Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium" style={{ color: 'var(--color-foreground)' }}>Budget Schedule</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Configure your budget cycle in Personal Preferences.</p>
            <Link href="/dashboard/settings?section=households&tab=personal" className="inline-flex items-center gap-1 text-[11px] mt-1" style={{ color: 'var(--color-primary)' }}>
              Configure <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          </div>
        </div>
      </Section>

      {/* ── Debt Strategy ───────────────────────────────────────────────── */}
      <Section
        icon={CreditCard}
        label={
          <>
            Debt Payoff Strategy
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="ml-1.5" style={{ color: 'var(--color-muted-foreground)' }}>
                    <Info className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-[12px]">
                  When enabled, debts are managed with a centralized payoff strategy. In budget view, debts appear as a single &quot;Debt Payments&quot; line.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        }
        accent="var(--color-destructive)"
        footer={
          <Button onClick={handleSaveDebtStrategy} disabled={savingDebt} size="sm" variant="outline" className="text-[12px] h-8 px-4 font-medium" style={{ border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
            {savingDebt ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Save Strategy</>}
          </Button>
        }
      >
        <SwitchRow
          id="debtStrategy"
          label="Use Debt Payoff Strategy"
          description={debtSettings.debtStrategyEnabled ? 'Debts are managed by your payoff strategy.' : 'Each debt appears as an individual budget line.'}
          checked={debtSettings.debtStrategyEnabled}
          onCheckedChange={v => setDebtSettings({ ...debtSettings, debtStrategyEnabled: v })}
        />

        {debtSettings.debtStrategyEnabled ? (
          <div
            className="space-y-4 rounded-lg px-3 py-3"
            style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 70%, transparent)', border: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}
          >
            <Field label="Payoff Method" id="payoffMethod" helper={debtSettings.debtPayoffMethod === 'avalanche' ? 'Pays highest interest debts first to minimize total interest.' : 'Pays smallest balances first for quick wins and motivation.'}>
              <Select value={debtSettings.debtPayoffMethod} onValueChange={(v: 'snowball' | 'avalanche') => setDebtSettings({ ...debtSettings, debtPayoffMethod: v })}>
                <SelectTrigger id="payoffMethod" name="payoffMethod" aria-label="Select payoff method" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avalanche">Avalanche — Highest Interest First</SelectItem>
                  <SelectItem value="snowball">Snowball — Lowest Balance First</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Extra Monthly Payment" helper="Additional amount applied to focus debt each month." id="extraPayment">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>$</span>
                <Input id="extraPayment" type="number" min="0" step="10" value={debtSettings.extraMonthlyPayment} onChange={e => setDebtSettings({ ...debtSettings, extraMonthlyPayment: parseFloat(e.target.value) || 0 })} className="pl-7 h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }} placeholder="0" />
              </div>
            </Field>

            <Field label="Payment Frequency" helper="How often you make debt payments." id="paymentFrequency">
              <Select value={debtSettings.paymentFrequency} onValueChange={(v: 'weekly' | 'biweekly' | 'monthly') => setDebtSettings({ ...debtSettings, paymentFrequency: v })}>
                <SelectTrigger id="paymentFrequency" name="paymentFrequency" aria-label="Select payment frequency" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Link href="/dashboard/debts" className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--color-primary)' }}>
              Manage individual debts <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        ) : (
          <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-elevated) 60%, transparent)', border: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
            <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
              With strategy disabled, each debt appears as a separate line in your budget. You can set custom payment amounts individually.
            </p>
            <Link href="/dashboard/debts" className="inline-flex items-center gap-1 text-[12px] mt-1.5" style={{ color: 'var(--color-primary)' }}>
              View and manage debts <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}
      </Section>
    </div>
  );
}
