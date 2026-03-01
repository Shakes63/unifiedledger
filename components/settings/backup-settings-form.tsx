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
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, Database, Download, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { useHousehold } from '@/contexts/household-context';

interface BackupSettings {
  id?: string;
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  format: 'json' | 'csv';
  retentionCount: number;
  emailBackups: boolean;
  lastBackupAt: string | null;
  nextBackupAt: string | null;
}

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

export function BackupSettingsForm() {
  const { selectedHouseholdId } = useHousehold();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [settings, setSettings] = useState<BackupSettings>({
    enabled: false,
    frequency: 'weekly',
    format: 'json',
    retentionCount: 10,
    emailBackups: false,
    lastBackupAt: null,
    nextBackupAt: null,
  });

  const fetchSettings = useCallback(async () => {
    if (!selectedHouseholdId) { setLoading(false); return; }
    try {
      setLoading(true);
      const res = await fetch('/api/user/backup-settings', { headers: { 'x-household-id': selectedHouseholdId }, credentials: 'include' });
      if (res.ok) { const d = await res.json(); setSettings(d.settings); }
      else { const d = await res.json(); toast.error(d.error?.includes('Household') ? 'Please select a household' : 'Failed to load backup settings'); }
    } catch (e) { console.error('Failed to fetch backup settings:', e); toast.error('Failed to load backup settings'); }
    finally { setLoading(false); }
  }, [selectedHouseholdId]);

  useEffect(() => { if (selectedHouseholdId) fetchSettings(); }, [selectedHouseholdId, fetchSettings]);

  async function saveSettings(updates: Partial<BackupSettings>) {
    if (!selectedHouseholdId) { toast.error('Please select a household'); return; }
    try {
      setSaving(true);
      const res = await fetch('/api/user/backup-settings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-household-id': selectedHouseholdId }, credentials: 'include', body: JSON.stringify({ ...updates, householdId: selectedHouseholdId }) });
      if (res.ok) { const d = await res.json(); setSettings(d.settings); toast.success('Backup settings saved'); }
      else { const d = await res.json(); toast.error(d.error || 'Failed to save settings'); }
    } catch (e) { console.error('Failed to save backup settings:', e); toast.error('Failed to save backup settings'); }
    finally { setSaving(false); }
  }

  async function createManualBackup() {
    if (!selectedHouseholdId) { toast.error('Please select a household'); return; }
    try {
      setCreatingBackup(true);
      const res = await fetch('/api/user/backups/create', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-household-id': selectedHouseholdId }, credentials: 'include', body: JSON.stringify({ householdId: selectedHouseholdId }) });
      if (res.ok) { toast.success('Backup created'); fetchSettings(); }
      else { const d = await res.json(); toast.error(d.error || 'Failed to create backup'); }
    } catch (e) { console.error('Failed to create backup:', e); toast.error('Failed to create backup'); }
    finally { setCreatingBackup(false); }
  }

  function formatDate(ds: string | null): string {
    if (!ds) return 'Not scheduled';
    try { return new Date(ds).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch { return 'Invalid date'; }
  }

  if (!selectedHouseholdId) {
    return (
      <div className="rounded-xl px-4 py-6 text-center text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)' }}>
        Please select a household to configure backup settings.
      </div>
    );
  }

  if (loading) {
    return <div className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }} />;
  }

  const sel = (id: string) => ({ id, name: id, className: 'h-9 text-[13px]', style: { backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' } });

  return (
    <Section
      icon={Database}
      label="Backup Settings"
      accent="var(--color-primary)"
      footer={
        <Button variant="outline" size="sm" onClick={createManualBackup} disabled={creatingBackup || saving} className="text-[12px] h-8">
          {creatingBackup ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
          Create Backup Now
        </Button>
      }
    >
      {/* Enable toggle */}
      <div className="flex items-center justify-between gap-4 px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
        <div>
          <Label htmlFor="backup-enabled" className="text-[13px] font-medium cursor-pointer" style={{ color: 'var(--color-foreground)' }}>
            Automatic Backups
          </Label>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
            Automatically create backups of your financial data on a schedule.
          </p>
        </div>
        <Switch id="backup-enabled" checked={settings.enabled} onCheckedChange={checked => saveSettings({ enabled: checked })} disabled={saving} />
      </div>

      {settings.enabled && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Frequency</p>
              <Select value={settings.frequency} onValueChange={(v: 'daily' | 'weekly' | 'monthly') => saveSettings({ frequency: v })} disabled={saving}>
                <SelectTrigger {...sel('backup-frequency')} aria-label="Select backup frequency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Format</p>
              <Select value={settings.format} onValueChange={(v: 'json' | 'csv') => saveSettings({ format: v })} disabled={saving}>
                <SelectTrigger {...sel('backup-format')} aria-label="Select backup format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON (recommended)</SelectItem>
                  <SelectItem value="csv" disabled>CSV (coming soon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Keep Last N Backups</p>
            <Input
              id="backup-retention" name="backup-retention" type="number" min="1" max="100"
              value={settings.retentionCount}
              onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1 && v <= 100) saveSettings({ retentionCount: v }); }}
              disabled={saving}
              className="h-9 text-[13px] w-32"
              style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
            />
            <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.75 }}>Older backups are automatically deleted (1–100).</p>
          </div>

          {(settings.nextBackupAt || settings.lastBackupAt) && (
            <div className="space-y-1.5 pt-1">
              {settings.nextBackupAt && (
                <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
                  <CalendarClock className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                  <span>Next: <span style={{ color: 'var(--color-foreground)' }}>{formatDate(settings.nextBackupAt)}</span></span>
                </div>
              )}
              {settings.lastBackupAt && (
                <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
                  <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                  <span>Last: <span style={{ color: 'var(--color-foreground)' }}>{formatDate(settings.lastBackupAt)}</span></span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Section>
  );
}
