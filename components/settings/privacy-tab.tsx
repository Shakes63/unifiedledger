'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Monitor,
  Smartphone,
  Download,
  Trash2,
  AlertTriangle,
  LogOut,
  Loader2,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useHousehold } from '@/contexts/household-context';
import { useRouter } from 'next/navigation';
import { TwoFactorSection } from '@/components/settings/two-factor-section';
import { OAuthProvidersSection } from '@/components/settings/oauth-providers-section';
import { getTodayLocalDateString } from '@/lib/utils/local-date';

interface Session {
  id: string;
  deviceInfo: string;
  ipAddress: string | null;
  location: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
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
      <div className="px-4 py-4">{children}</div>
      {footer && (
        <div className="px-4 py-3 flex items-center justify-end gap-2" style={{ borderTop: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 35%, transparent)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PrivacyTab() {
  const { selectedHouseholdId } = useHousehold();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState<number>(30);
  const [savingTimeout, setSavingTimeout] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchSessions(); }, []);

  async function fetchSessions() {
    try {
      const sessRes = await fetch('/api/user/sessions', { credentials: 'include' });
      if (sessRes.ok) { const d = await sessRes.json(); setSessions(d.sessions); }

      const setRes = await fetch('/api/user/settings', { credentials: 'include' });
      if (setRes.ok) { const d = await setRes.json(); setSessionTimeout(d.settings.sessionTimeout || 30); }
    } catch { toast.error('Failed to load sessions'); }
    finally { setLoading(false); }
  }

  async function handleTimeoutChange(value: string) {
    const n = parseInt(value, 10);
    setSessionTimeout(n);
    try {
      setSavingTimeout(true);
      const res = await fetch('/api/user/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionTimeout: n }) });
      if (!res.ok) throw new Error('Failed');
      toast.success('Session timeout updated');
    } catch { toast.error('Failed to save session timeout'); fetchSessions(); }
    finally { setSavingTimeout(false); }
  }

  async function revokeSession(id: string) {
    try {
      const res = await fetch(`/api/user/sessions/${id}`, { credentials: 'include', method: 'DELETE' });
      if (res.ok) { toast.success('Session revoked'); fetchSessions(); }
      else { const d = await res.json(); toast.error(d.error || 'Failed to revoke session'); }
    } catch { toast.error('Failed to revoke session'); }
  }

  async function revokeAllSessions() {
    try {
      const res = await fetch('/api/user/sessions/revoke-all', { credentials: 'include', method: 'POST' });
      if (res.ok) { toast.success('All other sessions revoked'); fetchSessions(); }
      else { toast.error('Failed to revoke sessions'); }
    } catch { toast.error('Failed to revoke sessions'); }
  }

  async function exportAllData() {
    try {
      setExporting(true);
      const res = await fetch('/api/user/export', { credentials: 'include' });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `unifiedledger-export-${getTodayLocalDateString()}.json`; a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Data exported');
      } else { toast.error('Failed to export data'); }
    } catch { toast.error('Failed to export data'); }
    finally { setExporting(false); }
  }

  async function exportCSV() {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (!selectedHouseholdId) { toast.error('Please select a household first'); return; }

      const res = await fetch(`/api/user/export/csv?${params}`, { credentials: 'include', headers: { 'x-household-id': selectedHouseholdId } });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `transactions-${startDate || 'all'}-${endDate || 'all'}.csv`; a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Transactions exported');
        setCsvDialogOpen(false); setStartDate(''); setEndDate('');
      } else { toast.error('Failed to export transactions'); }
    } catch { toast.error('Failed to export transactions'); }
    finally { setExporting(false); }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== 'DELETE MY ACCOUNT') { toast.error('Please type the confirmation text exactly'); return; }
    if (!deletePassword) { toast.error('Password is required'); return; }
    try {
      setDeleting(true);
      const res = await fetch('/api/user/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: deletePassword, confirmation: deleteConfirmation }) });
      if (res.ok) { toast.success('Account deleted. Goodbye!'); setTimeout(() => router.push('/'), 1000); }
      else { const d = await res.json(); toast.error(d.error || 'Failed to delete account'); }
    } catch { toast.error('Failed to delete account'); }
    finally { setDeleting(false); }
  }

  function formatLastActive(ds: string) {
    const diffMins = Math.floor((Date.now() - new Date(ds).getTime()) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const h = Math.floor(diffMins / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function getCountryFlag(cc: string | null) {
    if (!cc || cc.length !== 2) return '';
    try { return String.fromCodePoint(...cc.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))); }
    catch { return ''; }
  }

  return (
    <div className="space-y-4">

      {/* ── Active Sessions ───────────────────────────────────────────── */}
      <Section
        icon={Monitor}
        label="Active Sessions"
        footer={sessions.length > 1 ? (
          <Button variant="outline" size="sm" onClick={revokeAllSessions} className="text-[12px] h-8" style={{ borderColor: 'var(--color-destructive)', color: 'var(--color-destructive)' }}>
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Revoke All Other Sessions
          </Button>
        ) : undefined}
      >
        {loading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => <div key={i} className="h-14 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)', animationDelay: `${i * 80}ms` }} />)}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-[13px] py-4 text-center" style={{ color: 'var(--color-muted-foreground)' }}>No active sessions found</p>
        ) : (
          <div className="divide-y rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            {sessions.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2.5" style={{ backgroundColor: 'var(--color-elevated)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                  {s.deviceInfo.includes('iPhone') || s.deviceInfo.includes('Android')
                    ? <Smartphone className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />
                    : <Monitor className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-medium truncate" style={{ color: 'var(--color-foreground)' }}>{s.deviceInfo}</span>
                    {s.isCurrent && (
                      <Badge className="text-[10px] h-4 px-1.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 15%, transparent)', color: 'var(--color-success)', border: '1px solid color-mix(in oklch, var(--color-success) 30%, transparent)' }}>
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] flex items-center gap-2 flex-wrap" style={{ color: 'var(--color-muted-foreground)', opacity: 0.8 }}>
                    {s.ipAddress && <span>{s.ipAddress}</span>}
                    {s.location && <span>{getCountryFlag(s.countryCode)} {s.location}</span>}
                    <span>{formatLastActive(s.lastActive)}</span>
                  </div>
                </div>
                {!s.isCurrent && (
                  <Button variant="ghost" size="sm" onClick={() => revokeSession(s.id)} className="h-7 text-[11px] shrink-0" style={{ color: 'var(--color-destructive)' }}>
                    <LogOut className="w-3.5 h-3.5 mr-1" />
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Session Security ──────────────────────────────────────────── */}
      <Section icon={Clock} label="Session Security" accent="var(--color-warning)">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Session Timeout</p>
          <Select value={sessionTimeout.toString()} onValueChange={handleTimeoutChange} disabled={savingTimeout}>
            <SelectTrigger id="sessionTimeout" name="sessionTimeout" aria-label="Select session timeout" className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="30">30 minutes (recommended)</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
              <SelectItem value="240">4 hours</SelectItem>
              <SelectItem value="480">8 hours</SelectItem>
              <SelectItem value="0">Never (not recommended)</SelectItem>
            </SelectContent>
          </Select>
          {sessionTimeout === 0 ? (
            <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--color-warning)' }}>
              <AlertTriangle className="w-3 h-3" />
              Disabling session timeout reduces account security.
            </p>
          ) : (
            <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.75 }}>
              You'll be logged out after {sessionTimeout} {sessionTimeout === 1 ? 'minute' : 'minutes'} of inactivity.
            </p>
          )}
          {savingTimeout && <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--color-primary)' }}><Loader2 className="w-3 h-3 animate-spin" />Saving…</p>}
        </div>
      </Section>

      {/* ── 2FA ──────────────────────────────────────────────────────── */}
      <TwoFactorSection />

      {/* ── OAuth Providers ───────────────────────────────────────────── */}
      <OAuthProvidersSection />

      {/* ── Data Export ───────────────────────────────────────────────── */}
      <Section icon={Download} label="Data Export" accent="var(--color-primary)">
        <div className="space-y-2">
          <p className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>Download your data for backup or migration.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportAllData} disabled={exporting} className="text-[12px] h-8">
              {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
              Export All Data (JSON)
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCsvDialogOpen(true)} disabled={exporting} className="text-[12px] h-8">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export Transactions (CSV)
            </Button>
          </div>
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
            <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Delete Account</p>
            <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
          </div>
          <Button size="sm" onClick={() => setDeleteDialogOpen(true)} className="shrink-0 text-[12px] h-8" style={{ backgroundColor: 'var(--color-destructive)', color: 'white' }}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete Account
          </Button>
        </div>
      </div>

      {/* ── CSV Export Dialog ─────────────────────────────────────────── */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-foreground)' }}>Export Transactions</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>
              Select a date range (optional) to narrow the export.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Start Date</Label>
              <Input id="startDate" name="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate" className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>End Date</Label>
              <Input id="endDate" name="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setCsvDialogOpen(false); setStartDate(''); setEndDate(''); }} className="text-[12px]">Cancel</Button>
            <Button size="sm" onClick={exportCSV} disabled={exporting} className="text-[12px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
              Export CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Account Dialog ─────────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'color-mix(in oklch, var(--color-destructive) 40%, var(--color-border))', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-destructive)' }}>Delete Account</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>
              This is permanent and cannot be undone. All your data will be deleted.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); deleteAccount(); }}>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="deletePassword" className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Password</Label>
                <Input id="deletePassword" name="deletePassword" type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder="Enter your password" required className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deleteConfirm" className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>
                  Type &quot;DELETE MY ACCOUNT&quot; to confirm
                </Label>
                <Input id="deleteConfirm" name="deleteConfirm" type="text" value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} placeholder="DELETE MY ACCOUNT" required className="h-9 text-[13px] font-mono" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }} />
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { setDeleteDialogOpen(false); setDeletePassword(''); setDeleteConfirmation(''); }} className="text-[12px]">Cancel</Button>
              <Button type="submit" size="sm" disabled={deleteConfirmation !== 'DELETE MY ACCOUNT' || !deletePassword || deleting} className="text-[12px]" style={{ backgroundColor: 'var(--color-destructive)', color: 'white' }}>
                {deleting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                Delete Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
