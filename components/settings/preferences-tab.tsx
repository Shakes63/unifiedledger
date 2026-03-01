'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Loader2, Globe, Hash, CalendarDays, Landmark, CheckCircle2 } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

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
  { value: 'USD', label: 'USD — US Dollar ($)'       },
  { value: 'EUR', label: 'EUR — Euro (€)'            },
  { value: 'GBP', label: 'GBP — British Pound (£)'   },
  { value: 'CAD', label: 'CAD — Canadian Dollar (C$)' },
  { value: 'AUD', label: 'AUD — Australian Dollar (A$)' },
  { value: 'JPY', label: 'JPY — Japanese Yen (¥)'    },
];

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY  ·  12/31/2025' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY  ·  31/12/2025' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD  ·  2025-12-31' },
];

const NUMBER_FORMATS = [
  { value: 'en-US', label: '1,000.00  ·  US'     },
  { value: 'en-GB', label: '1,000.00  ·  UK'     },
  { value: 'de-DE', label: '1.000,00  ·  Germany' },
  { value: 'fr-FR', label: '1 000,00  ·  France'  },
];

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

// ── Component ─────────────────────────────────────────────────────────────────

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
  const { fetchWithHousehold, selectedHouseholdId } = useHouseholdFetch();

  const fetchData = useCallback(async () => {
    try {
      const settingsRes = await fetch('/api/user/settings', { credentials: 'include' });
      if (settingsRes.ok) {
        const d = await settingsRes.json();
        setPreferences({
          currency:         d.settings.currency         || 'USD',
          dateFormat:       d.settings.dateFormat       || 'MM/DD/YYYY',
          numberFormat:     d.settings.numberFormat     || 'en-US',
          defaultAccountId: d.settings.defaultAccountId || null,
          firstDayOfWeek:   d.settings.firstDayOfWeek  || 'sunday',
        });
      }
      if (selectedHouseholdId) {
        const accRes = await fetchWithHousehold('/api/accounts');
        if (accRes.ok) {
          const d = await accRes.json();
          const list = Array.isArray(d) ? d : (d.accounts || []);
          setAccounts(list);
        }
      }
    } catch (e) {
      if (!(e instanceof Error && e.message === 'No household selected')) {
        toast.error('Failed to load preferences');
      }
    } finally {
      setLoading(false);
    }
  }, [fetchWithHousehold, selectedHouseholdId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Preferences saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const sel = (id: string) => ({
    id,
    name: id,
    className: 'h-9 text-[13px]',
    style: { backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' },
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-40 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    );
  }

  const saveFooter = (
    <Button onClick={handleSave} disabled={saving} size="sm" className="text-[12px] h-8 px-4 font-medium" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
      {saving
        ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</>
        : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Save Preferences</>
      }
    </Button>
  );

  return (
    <div className="space-y-4">

      {/* ── Regional & Format ────────────────────────────────────────── */}
      <Section icon={Globe} label="Regional & Format" footer={saveFooter}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Default Currency" helper="Currency used for displaying amounts throughout the app." id="currency">
            <Select value={preferences.currency} onValueChange={v => setPreferences({ ...preferences, currency: v })}>
              <SelectTrigger {...sel('currency')} aria-label="Select default currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Number Format" id="numberFormat">
            <Select value={preferences.numberFormat} onValueChange={(v: PreferencesData['numberFormat']) => setPreferences({ ...preferences, numberFormat: v })}>
              <SelectTrigger {...sel('numberFormat')} aria-label="Select number format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NUMBER_FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Date Format" id="dateFormat">
            <Select value={preferences.dateFormat} onValueChange={(v: PreferencesData['dateFormat']) => setPreferences({ ...preferences, dateFormat: v })}>
              <SelectTrigger {...sel('dateFormat')} aria-label="Select date format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Start of Week" helper="First day of week for calendar views." id="firstDayOfWeek">
            <Select value={preferences.firstDayOfWeek} onValueChange={(v: PreferencesData['firstDayOfWeek']) => setPreferences({ ...preferences, firstDayOfWeek: v })}>
              <SelectTrigger {...sel('firstDayOfWeek')} aria-label="Select first day of week">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sunday">Sunday</SelectItem>
                <SelectItem value="monday">Monday</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      {/* ── Defaults ─────────────────────────────────────────────────── */}
      <Section icon={Landmark} label="Defaults" footer={saveFooter}>
        <Field label="Default Account" helper="Account pre-selected when creating transactions." id="defaultAccount">
          <Select value={preferences.defaultAccountId || 'none'} onValueChange={v => setPreferences({ ...preferences, defaultAccountId: v === 'none' ? null : v })}>
            <SelectTrigger {...sel('defaultAccount')} aria-label="Select default account">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No default account</SelectItem>
              {accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} <span style={{ opacity: 0.6 }}>· {a.type}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Section>

      {/* Suppress unused icon imports */}
      <span className="hidden"><Hash /><CalendarDays /></span>
    </div>
  );
}
