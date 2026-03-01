'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Database, Trash2, AlertTriangle, Loader2, Shield, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { hardRedirect } from '@/lib/navigation/hard-redirect';
import { BackupSettingsForm } from './backup-settings-form';
import { BackupHistory } from './backup-history';
import { CalendarSyncSection } from './calendar-sync-section';

interface ImportTemplate {
  id: string;
  name: string;
  description: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  isFavorite: boolean;
  createdAt: string;
}

// ── Shared helpers ────────────────────────────────────────────────────────────
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

// ── Component ─────────────────────────────────────────────────────────────────

export function DataTab() {
  const [dataRetentionYears, setDataRetentionYears] = useState('7');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false);
  const [resetDataDialogOpen, setResetDataDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [importTemplates, setImportTemplates] = useState<ImportTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [defaultImportTemplateId, setDefaultImportTemplateId] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [backupHistoryDialogOpen, setBackupHistoryDialogOpen] = useState(false);

  useEffect(() => { fetchSettings(); fetchImportTemplates(); }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/user/settings', { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setDataRetentionYears(d.dataRetentionYears?.toString() || '7'); setDefaultImportTemplateId(d.defaultImportTemplateId || null); }
    } catch { toast.error('Failed to load settings'); }
    finally { setLoading(false); }
  }

  async function fetchImportTemplates() {
    try {
      const res = await fetch('/api/import-templates', { credentials: 'include' });
      if (res.ok) { setImportTemplates(await res.json()); }
    } catch (e) { console.error('Failed to load import templates:', e); }
    finally { setLoadingTemplates(false); }
  }

  async function saveDataRetention(years: string) {
    try {
      setSaving(true);
      const res = await fetch('/api/user/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataRetentionYears: parseInt(years) }) });
      if (res.ok) { toast.success('Data retention policy updated'); setDataRetentionYears(years); }
      else { toast.error('Failed to update settings'); }
    } catch { toast.error('Failed to update settings'); }
    finally { setSaving(false); }
  }

  async function handleTemplateChange(value: string) {
    try {
      setSavingTemplate(true);
      const templateId = value === 'none' ? null : value;
      const res = await fetch('/api/user/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ defaultImportTemplateId: templateId }) });
      if (res.ok) {
        setDefaultImportTemplateId(templateId);
        if (templateId) { const t = importTemplates.find(t => t.id === templateId); toast.success(`Default template set to "${t?.name}"`); }
        else { toast.success('Default import template cleared'); }
      } else { const d = await res.json(); toast.error(d.error || 'Failed to update template preference'); }
    } catch { toast.error('Failed to update template preference'); }
    finally { setSavingTemplate(false); }
  }

  async function clearCache() {
    try {
      if ('caches' in window) { const ns = await caches.keys(); await Promise.all(ns.map(n => caches.delete(n))); }
      if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.update())); }
      toast.success('Cache cleared');
      setClearCacheDialogOpen(false);
      setTimeout(() => window.location.reload(), 1000);
    } catch { toast.error('Failed to clear cache'); }
  }

  async function resetAppData() {
    if (!resetPassword) { toast.error('Please enter your password'); return; }
    if (!resetConfirmed) { toast.error('Please confirm you understand this action'); return; }
    try {
      setResetting(true);
      const res = await fetch('/api/user/reset-app-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: resetPassword, confirm: true }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to reset app data');
      if ('caches' in window) { const ns = await caches.keys(); await Promise.all(ns.map(n => caches.delete(n))); }
      localStorage.clear(); sessionStorage.clear();
      toast.success('App data reset! Logging out in 3 seconds…');
      setResetDataDialogOpen(false); setResetPassword(''); setResetConfirmed(false);
      setTimeout(() => hardRedirect('/sign-in'), 3000);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to reset app data'); }
    finally { setResetting(false); }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', animationDelay: `${i * 80}ms` }} />)}
      </div>
    );
  }

  const sel = (id: string) => ({ id, name: id, className: 'h-9 text-[13px]', style: { backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' } });
  const selectedTemplate = importTemplates.find(t => t.id === defaultImportTemplateId);

  return (
    <div className="space-y-4">

      {/* ── Data Retention ────────────────────────────────────────────── */}
      <Section icon={Database} label="Data Retention" accent="var(--color-primary)">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Keep Transactions For</p>
          <Select value={dataRetentionYears} onValueChange={saveDataRetention} disabled={saving}>
            <SelectTrigger {...sel('dataRetention')} aria-label="Select data retention period"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 year</SelectItem>
              <SelectItem value="3">3 years</SelectItem>
              <SelectItem value="5">5 years</SelectItem>
              <SelectItem value="7">7 years (recommended)</SelectItem>
              <SelectItem value="10">10 years</SelectItem>
              <SelectItem value="999">Forever</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.75 }}>Transactions older than this will be automatically archived.</p>
        </div>
      </Section>

      {/* ── Import Preferences ────────────────────────────────────────── */}
      <Section icon={FileSpreadsheet} label="Import Preferences" accent="var(--color-primary)">
        {loadingTemplates ? (
          <div className="h-9 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
        ) : importTemplates.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Default Import Template</p>
              <Select value={defaultImportTemplateId || 'none'} onValueChange={handleTemplateChange} disabled={savingTemplate}>
                <SelectTrigger {...sel('defaultTemplate')} aria-label="Select default import template">
                  <SelectValue placeholder="No default template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default template</SelectItem>
                  {importTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.usageCount > 0 && <span style={{ opacity: 0.6 }}> · {t.usageCount} uses</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.75 }}>Pre-selected when you import CSV files.</p>
            </div>
            {selectedTemplate && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>{selectedTemplate.name}</span>
                    {selectedTemplate.isFavorite && <Badge className="text-[10px] h-4 px-1.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)', border: '1px solid color-mix(in oklch, var(--color-primary) 25%, transparent)' }}>Favorite</Badge>}
                  </div>
                  {selectedTemplate.description && <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>{selectedTemplate.description}</p>}
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.8 }}>
                    {selectedTemplate.lastUsedAt && <span>Last used: {new Date(selectedTemplate.lastUsedAt).toLocaleDateString()}</span>}
                    <span>Used {selectedTemplate.usageCount}×</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
            <div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>No Templates Yet</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                Go to Transactions → Import CSV and save column mappings as a template to enable this feature.
              </p>
            </div>
          </div>
        )}
      </Section>

      {/* ── Calendar Sync ─────────────────────────────────────────────── */}
      <CalendarSyncSection />

      {/* ── Automatic Backups ─────────────────────────────────────────── */}
      <BackupSettingsForm />

      {/* Backup History link */}
      <div className="flex">
        <Button variant="outline" size="sm" onClick={() => setBackupHistoryDialogOpen(true)} className="text-[12px] h-8">
          View Backup History
        </Button>
      </div>

      {/* ── Cache Management ──────────────────────────────────────────── */}
      <Section icon={Database} label="Cache Management" accent="var(--color-muted-foreground)">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Clear Cache</p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>Remove temporary files and cached data. The app will reload after clearing.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setClearCacheDialogOpen(true)} className="text-[12px] h-8 shrink-0">Clear Cache</Button>
        </div>
      </Section>

      {/* ── Danger Zone ───────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid color-mix(in oklch, var(--color-destructive) 35%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-destructive) 4%, var(--color-background))' }}>
        <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-destructive) 20%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-destructive) 8%, transparent)', borderLeft: '3px solid var(--color-destructive)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-destructive)', opacity: 0.85 }} />
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-destructive)' }}>Danger Zone</span>
        </div>
        <div className="px-4 py-4 flex items-start gap-3">
          <div className="flex-1 space-y-1">
            <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Reset App Data</p>
            <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
              Clear all app settings and cached data. Your account and financial data will <strong>not</strong> be affected.
            </p>
          </div>
          <Button size="sm" onClick={() => setResetDataDialogOpen(true)} className="shrink-0 text-[12px] h-8" style={{ backgroundColor: 'var(--color-destructive)', color: 'white' }}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Reset
          </Button>
        </div>
      </div>

      {/* ── Clear Cache Dialog ────────────────────────────────────────── */}
      <Dialog open={clearCacheDialogOpen} onOpenChange={setClearCacheDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-foreground)' }}>Clear Cache?</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>This will clear all cached data and reload the application.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setClearCacheDialogOpen(false)} className="text-[12px]">Cancel</Button>
            <Button size="sm" onClick={clearCache} className="text-[12px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>Clear Cache</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset Data Dialog ─────────────────────────────────────────── */}
      <Dialog open={resetDataDialogOpen} onOpenChange={open => { setResetDataDialogOpen(open); if (!open) { setResetPassword(''); setResetConfirmed(false); } }}>
        <DialogContent className="max-w-md" style={{ backgroundColor: 'var(--color-background)', borderColor: 'color-mix(in oklch, var(--color-destructive) 40%, var(--color-border))', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--color-destructive)' }}>
              <AlertTriangle className="w-4 h-4" />
              Reset App Data
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>
              This resets your preferences to defaults. Your financial data will NOT be affected.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); resetAppData(); }}>
            <div className="space-y-3 py-2">
              {/* Will reset */}
              <div className="rounded-lg px-3 py-2.5 space-y-1" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 6%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 20%, transparent)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1" style={{ color: 'var(--color-destructive)' }}><AlertTriangle className="w-3 h-3" />Will reset</p>
                <ul className="text-[12px] space-y-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                  {['All preferences and settings', 'Theme selection', 'Saved searches and filters', 'Import templates', 'Cached data'].map(item => (
                    <li key={item}>· {item}</li>
                  ))}
                </ul>
              </div>
              {/* Will NOT affect */}
              <div className="rounded-lg px-3 py-2.5 space-y-1" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 6%, transparent)', border: '1px solid color-mix(in oklch, var(--color-success) 20%, transparent)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1" style={{ color: 'var(--color-success)' }}><Shield className="w-3 h-3" />Will NOT affect</p>
                <ul className="text-[12px] space-y-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                  {['Transactions and accounts', 'Bills and budgets', 'Goals and debts', 'Tax records', 'Household data'].map(item => (
                    <li key={item}>· {item}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="resetPassword" className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Confirm Password</Label>
                <Input id="resetPassword" name="resetPassword" type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Enter your password" disabled={resetting} required className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }} />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="resetConfirm" name="resetConfirm" checked={resetConfirmed} onCheckedChange={c => setResetConfirmed(c === true)} disabled={resetting} required className="mt-0.5" />
                <label htmlFor="resetConfirm" className="text-[12px] cursor-pointer leading-tight" style={{ color: 'var(--color-foreground)' }}>
                  I understand this will reset all my preferences and settings
                </label>
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setResetDataDialogOpen(false)} disabled={resetting} className="text-[12px]">Cancel</Button>
              <Button type="submit" size="sm" disabled={resetting || !resetPassword || !resetConfirmed} className="text-[12px]" style={{ backgroundColor: 'var(--color-destructive)', color: 'white' }}>
                {resetting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                Reset App Data
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Backup History Dialog ─────────────────────────────────────── */}
      <Dialog open={backupHistoryDialogOpen} onOpenChange={setBackupHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-foreground)' }}>Backup History</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>View and manage your backup files.</DialogDescription>
          </DialogHeader>
          <div className="py-2"><BackupHistory /></div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBackupHistoryDialogOpen(false)} className="text-[12px]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
