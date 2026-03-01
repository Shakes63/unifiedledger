'use client';

import { useState, useEffect } from 'react';
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
import { Loader2, Calendar, CheckCircle2 } from 'lucide-react';

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2,  label: 'February' },
  { value: 3, label: 'March'   }, { value: 4,  label: 'April'    },
  { value: 5, label: 'May'     }, { value: 6,  label: 'June'     },
  { value: 7, label: 'July'    }, { value: 8,  label: 'August'   },
  { value: 9, label: 'September' }, { value: 10, label: 'October'  },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

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

export function HouseholdPreferencesTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fiscalYearStart, setFiscalYearStart] = useState<number>(1);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/user/settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setFiscalYearStart(data.settings.fiscalYearStart || 1);
      }
    } catch {
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscalYearStart }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save');
      }
      toast.success('Preferences saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }} />
    );
  }

  return (
    <div className="space-y-4">
      <Section
        icon={Calendar}
        label="Fiscal Year"
        footer={
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="text-[12px] h-8 px-4 font-medium"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
          >
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</>
              : <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Save Preferences</>
            }
          </Button>
        }
      >
        <div className="space-y-1.5">
          <Label
            htmlFor="fiscalYearStart"
            className="text-[11px] font-medium uppercase tracking-wide block"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            Fiscal Year Start Month
          </Label>
          <Select value={fiscalYearStart.toString()} onValueChange={v => setFiscalYearStart(parseInt(v))}>
            <SelectTrigger
              id="fiscalYearStart"
              name="fiscalYearStart"
              aria-label="Select fiscal year start month"
              className="h-9 text-[13px]"
              style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => (
                <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.75 }}>
            First month of your fiscal year for reporting. Shared by all household members.
          </p>
        </div>
      </Section>
    </div>
  );
}
