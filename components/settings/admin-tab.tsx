'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Shield,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Database,
  Users,
  Home,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminUsersTab } from './admin-users-tab';

interface OAuthProvider {
  id: string;
  providerId: 'google' | 'github' | 'ticktick';
  clientId: string;
  hasClientSecret: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SystemInfo {
  version: string;
  totalUsers: number;
  totalHouseholds: number;
  databaseSize: number | null;
  databaseSizeFormatted: string;
  timestamp: string;
}

interface OAuthFormState {
  clientId: string;
  clientSecret: string;
  hasClientSecret: boolean;
  enabled: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  label,
  accent = 'var(--color-primary)',
  headerRight,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  accent?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 55%, transparent)', borderLeft: `3px solid ${accent}` }}>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent, opacity: 0.85 }} />}
        <span className="text-[11px] font-semibold uppercase tracking-widest flex-1" style={{ color: accent }}>{label}</span>
        {headerRight}
      </div>
      <div className="px-4 py-4 space-y-4">{children}</div>
    </div>
  );
}

function ProviderBlock({
  icon,
  label,
  sub,
  enabled,
  onToggle,
  clientId,
  onClientId,
  clientSecret,
  onClientSecret,
  hasClientSecret,
  onSave,
  saving,
  saveLabel,
  restartRequired,
}: {
  icon: React.ReactNode; label: string; sub?: string;
  enabled: boolean; onToggle: (v: boolean) => void;
  clientId: string; onClientId: (v: string) => void;
  clientSecret: string; onClientSecret: (v: string) => void;
  hasClientSecret: boolean;
  onSave: () => void; saving: boolean; saveLabel: string;
  restartRequired?: boolean;
}) {
  return (
    <div className="rounded-lg" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
      {/* Provider header */}
      <div className="px-3 py-2.5 flex items-center gap-2.5" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)' }}>
        <div className="shrink-0">{icon}</div>
        <div className="flex-1">
          <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>{label}</p>
          {sub && <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>{sub}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {enabled
            ? <Badge className="text-[10px] h-5 px-1.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 15%, transparent)', color: 'var(--color-success)', border: '1px solid color-mix(in oklch, var(--color-success) 25%, transparent)' }}><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />Enabled</Badge>
            : <Badge className="text-[10px] h-5 px-1.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-muted-foreground) 12%, transparent)', color: 'var(--color-muted-foreground)', border: '1px solid color-mix(in oklch, var(--color-muted-foreground) 20%, transparent)' }}><XCircle className="w-2.5 h-2.5 mr-0.5" />Disabled</Badge>
          }
          <Switch checked={enabled} onCheckedChange={v => { onToggle(v); if (!enabled && v && restartRequired) toast.info(`${label} login requires a server restart after saving.`, { duration: 5000 }); }} />
        </div>
      </div>
      {/* Fields */}
      <div className="px-3 py-3 space-y-2.5">
        <div className="space-y-1.5">
          <Label htmlFor={`${label}-cid`} className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Client ID</Label>
          <Input id={`${label}-cid`} type="text" value={clientId} onChange={e => onClientId(e.target.value)} placeholder={`Enter ${label} Client ID`} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${label}-cs`} className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Client Secret</Label>
          <Input id={`${label}-cs`} type="password" value={clientSecret} onChange={e => onClientSecret(e.target.value)} placeholder={hasClientSecret ? 'Stored (hidden) — enter to replace' : `Enter ${label} Client Secret`} className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }} />
        </div>
        <Button size="sm" onClick={onSave} disabled={saving || (enabled && (!clientId || (!hasClientSecret && !clientSecret)))} className="text-[12px] h-8" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminTab() {
  const [googleSettings, setGoogleSettings] = useState<OAuthFormState>({ clientId: '', clientSecret: '', hasClientSecret: false, enabled: false });
  const [githubSettings, setGithubSettings] = useState<OAuthFormState>({ clientId: '', clientSecret: '', hasClientSecret: false, enabled: false });
  const [ticktickSettings, setTicktickSettings] = useState<OAuthFormState>({ clientId: '', clientSecret: '', hasClientSecret: false, enabled: false });
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [savingGithub, setSavingGithub] = useState(false);
  const [savingTicktick, setSavingTicktick] = useState(false);
  const [refreshingSystemInfo, setRefreshingSystemInfo] = useState(false);

  useEffect(() => { fetchOAuthSettings(); fetchSystemInfo(); }, []);

  async function fetchOAuthSettings() {
    try {
      const res = await fetch('/api/admin/oauth-settings', { credentials: 'include' });
      if (!res.ok) { if (res.status === 403) toast.error('Access denied: Owner access required'); else throw new Error(); return; }
      const d = await res.json();
      const providers = (d.providers || []) as OAuthProvider[];
      const apply = (p: OAuthProvider | undefined, set: (s: OAuthFormState) => void) => { if (p) set({ clientId: p.clientId || '', clientSecret: '', hasClientSecret: Boolean(p.hasClientSecret), enabled: p.enabled !== false }); };
      apply(providers.find(p => p.providerId === 'google'), setGoogleSettings);
      apply(providers.find(p => p.providerId === 'github'), setGithubSettings);
      apply(providers.find(p => p.providerId === 'ticktick'), setTicktickSettings);
    } catch (e) { console.error('Error fetching OAuth settings:', e); toast.error('Failed to load OAuth settings'); }
    finally { setLoading(false); }
  }

  async function fetchSystemInfo() {
    try {
      const res = await fetch('/api/admin/system-info', { credentials: 'include' });
      if (!res.ok) { if (res.status !== 403) throw new Error(); return; }
      setSystemInfo(await res.json());
    } catch (e) { console.error('Error fetching system info:', e); }
  }

  async function saveOAuthSettings(providerId: 'google' | 'github' | 'ticktick', settings: OAuthFormState) {
    if (settings.enabled && (!settings.clientId || (!settings.hasClientSecret && !settings.clientSecret))) { toast.error('Client ID and Client Secret are required'); return; }
    const setSaving = providerId === 'google' ? setSavingGoogle : providerId === 'github' ? setSavingGithub : setSavingTicktick;
    const name = providerId === 'google' ? 'Google' : providerId === 'github' ? 'GitHub' : 'TickTick';
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { providerId, clientId: settings.clientId, enabled: settings.enabled };
      if (settings.clientSecret.trim().length > 0) payload.clientSecret = settings.clientSecret;
      const res = await fetch('/api/admin/oauth-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      if (!res.ok) { if (res.status === 403) { toast.error('Access denied: Owner access required'); return; } const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to save'); }
      toast.success(`${name} OAuth settings saved`);
      await fetchOAuthSettings();
    } catch (e) { toast.error(e instanceof Error ? e.message : `Failed to save ${name} OAuth settings`); }
    finally { setSaving(false); }
  }

  async function refreshSystemInfo() {
    setRefreshingSystemInfo(true);
    try { await fetchSystemInfo(); toast.success('System information refreshed'); }
    catch { toast.error('Failed to refresh system information'); }
    finally { setRefreshingSystemInfo(false); }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', animationDelay: `${i * 80}ms` }} />)}
      </div>
    );
  }

  const SYSTEM_STATS = systemInfo ? [
    { icon: Shield,   label: 'Version',           value: systemInfo.version           },
    { icon: Users,    label: 'Total Users',        value: String(systemInfo.totalUsers) },
    { icon: Home,     label: 'Total Households',   value: String(systemInfo.totalHouseholds) },
    { icon: Database, label: 'Database Size',      value: systemInfo.databaseSizeFormatted },
  ] : [];

  return (
    <div className="space-y-4">

      {/* ── OAuth Configuration ───────────────────────────────────────── */}
      <Section icon={Shield} label="OAuth Configuration" accent="var(--color-primary)">
        <ProviderBlock
          icon={<div className="w-7 h-7 rounded flex items-center justify-center text-white font-bold text-[11px]" style={{ backgroundColor: 'var(--color-primary)' }}>G</div>}
          label="Google OAuth" restartRequired
          enabled={googleSettings.enabled} onToggle={v => setGoogleSettings(p => ({ ...p, enabled: v }))}
          clientId={googleSettings.clientId} onClientId={v => setGoogleSettings(p => ({ ...p, clientId: v }))}
          clientSecret={googleSettings.clientSecret} onClientSecret={v => setGoogleSettings(p => ({ ...p, clientSecret: v }))}
          hasClientSecret={googleSettings.hasClientSecret}
          onSave={() => saveOAuthSettings('google', googleSettings)} saving={savingGoogle} saveLabel="Save Google" />

        <ProviderBlock
          icon={<div className="w-7 h-7 rounded flex items-center justify-center font-bold text-[11px]" style={{ backgroundColor: 'var(--color-foreground)', color: 'var(--color-background)' }}>GH</div>}
          label="GitHub OAuth" restartRequired
          enabled={githubSettings.enabled} onToggle={v => setGithubSettings(p => ({ ...p, enabled: v }))}
          clientId={githubSettings.clientId} onClientId={v => setGithubSettings(p => ({ ...p, clientId: v }))}
          clientSecret={githubSettings.clientSecret} onClientSecret={v => setGithubSettings(p => ({ ...p, clientSecret: v }))}
          hasClientSecret={githubSettings.hasClientSecret}
          onSave={() => saveOAuthSettings('github', githubSettings)} saving={savingGithub} saveLabel="Save GitHub" />

        <ProviderBlock
          icon={<div className="w-7 h-7 rounded flex items-center justify-center text-white font-bold text-[11px]" style={{ backgroundColor: '#4772FA' }}>TT</div>}
          label="TickTick OAuth" sub="For calendar sync integration"
          enabled={ticktickSettings.enabled} onToggle={v => setTicktickSettings(p => ({ ...p, enabled: v }))}
          clientId={ticktickSettings.clientId} onClientId={v => setTicktickSettings(p => ({ ...p, clientId: v }))}
          clientSecret={ticktickSettings.clientSecret} onClientSecret={v => setTicktickSettings(p => ({ ...p, clientSecret: v }))}
          hasClientSecret={ticktickSettings.hasClientSecret}
          onSave={() => saveOAuthSettings('ticktick', ticktickSettings)} saving={savingTicktick} saveLabel="Save TickTick" />

        {/* Note */}
        <div className="flex items-start gap-2.5 px-3 py-3 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 20%, transparent)' }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
          <ul className="text-[12px] space-y-1" style={{ color: 'var(--color-muted-foreground)' }}>
            <li>Client secrets are write-only: stored encrypted and never shown again.</li>
            <li>Google/GitHub providers are loaded at server startup; restart after enabling/disabling or changing credentials.</li>
            <li>TickTick settings take effect immediately — no restart needed.</li>
            <li>Ensure OAuth redirect URLs are configured correctly in the provider settings.</li>
          </ul>
        </div>
      </Section>

      {/* ── System Information ────────────────────────────────────────── */}
      <Section
        icon={Database}
        label="System Information"
        accent="var(--color-muted-foreground)"
        headerRight={
          <Button variant="outline" size="sm" onClick={refreshSystemInfo} disabled={refreshingSystemInfo} className="h-6 text-[11px] px-2.5">
            {refreshingSystemInfo ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Refresh
          </Button>
        }
      >
        {systemInfo ? (
          <div className="grid grid-cols-2 gap-2">
            {SYSTEM_STATS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />
                  <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>{label}</span>
                </div>
                <span className="text-[18px] font-bold tabular-nums leading-tight" style={{ color: 'var(--color-foreground)' }}>{value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 gap-2">
            <AlertCircle className="w-6 h-6" style={{ color: 'var(--color-muted-foreground)', opacity: 0.5 }} />
            <p className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>Unable to load system information</p>
          </div>
        )}
      </Section>

      {/* ── User Management ───────────────────────────────────────────── */}
      <div className="space-y-1">
        <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', paddingLeft: '2px' }}>
          Create, manage, and delete user accounts. Assign users to households with specific roles.
        </p>
        <AdminUsersTab />
      </div>
    </div>
  );
}

// Suppress unused imports
const _unused = Label;
void _unused;
