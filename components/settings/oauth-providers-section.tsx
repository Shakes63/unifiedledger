'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Loader2,
  Link2,
  Unlink,
  AlertTriangle,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { betterAuthClient } from '@/lib/better-auth-client';

interface OAuthProvider {
  providerId: string;
  accountId: string;
  linkedAt: string;
  isPrimary: boolean;
}

interface AvailableProvider {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  description: string;
}

// ── Section helper ────────────────────────────────────────────────────────────
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
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OAuthProvidersSection() {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>([]);
  const [primaryLoginMethod, setPrimaryLoginMethod] = useState<string>('email');
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [unlinkProvider, setUnlinkProvider] = useState<string | null>(null);

  useEffect(() => { fetchProviders(); fetchAvailableProviders(); }, []);

  async function fetchProviders() {
    try {
      const res = await fetch('/api/user/oauth/providers', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setProviders(d.providers || []);
        setPrimaryLoginMethod(d.primaryLoginMethod || 'email');
      }
    } catch (e) { console.error('Failed to fetch OAuth providers:', e); }
    finally { setLoading(false); }
  }

  async function fetchAvailableProviders() {
    try {
      const res = await fetch('/api/user/oauth/available', { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setAvailableProviders(d.providers || []); }
    } catch (e) { console.error('Failed to fetch available providers:', e); }
  }

  async function handleLinkProvider(providerId: string) {
    try {
      setLinking(providerId);
      const validateRes = await fetch(`/api/user/oauth/link/${providerId}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
      if (!validateRes.ok) { const d = await validateRes.json(); throw new Error(d.error || 'Failed to validate provider'); }

      const callbackURL = `${window.location.origin}/dashboard/settings`;
      const result = await betterAuthClient.signIn.social({ provider: providerId, callbackURL });
      const url = ('data' in result && result.data && typeof result.data === 'object' && 'url' in result.data)
        ? (result.data as { url: string }).url
        : ('url' in result && typeof result.url === 'string') ? result.url : null;

      if (url) { window.location.href = url; }
      else { throw new Error('Failed to get OAuth authorization URL'); }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to link provider'); setLinking(null); }
  }

  async function handleUnlinkProvider(providerId: string) {
    try {
      setUnlinking(providerId);
      const res = await fetch(`/api/user/oauth/unlink/${providerId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to unlink'); }
      toast.success(`${providerId} account unlinked`);
      setUnlinkDialogOpen(false); setUnlinkProvider(null);
      fetchProviders();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to unlink provider'); }
    finally { setUnlinking(null); }
  }

  async function handleSetPrimary(providerId: string) {
    try {
      const res = await fetch('/api/user/oauth/set-primary', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      toast.success('Primary login method updated');
      setPrimaryLoginMethod(providerId);
      fetchProviders();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to set primary method'); }
  }

  function getProviderName(providerId: string) {
    const p = availableProviders.find(p => p.id === providerId);
    return p?.name || (providerId.charAt(0).toUpperCase() + providerId.slice(1));
  }

  function isProviderLinked(providerId: string) {
    return providers.some(p => p.providerId === providerId);
  }

  const enabledProviders = availableProviders.filter(p => p.enabled);

  return (
    <>
      <Section icon={Link2} label="OAuth Providers" accent="var(--color-primary)">
        {loading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)', animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        ) : enabledProviders.length === 0 ? (
          <div className="flex items-center gap-3 px-3 py-4 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 20%, transparent)' }}>
            <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'var(--color-warning)' }} />
            <p className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>
              No OAuth providers configured. Contact your administrator.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Provider rows */}
            <div className="divide-y rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)', '--tw-divide-opacity': 1 } as React.CSSProperties}>
              {enabledProviders.map(ap => {
                const isLinked = isProviderLinked(ap.id);
                const linked = providers.find(p => p.providerId === ap.id);
                return (
                  <div key={ap.id} className="flex items-center gap-3 px-3 py-2.5" style={{ backgroundColor: 'var(--color-elevated)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                      <Globe className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>{ap.name}</span>
                        {isLinked && (
                          <Badge className="text-[10px] h-4 px-1.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 15%, transparent)', color: 'var(--color-success)', border: '1px solid color-mix(in oklch, var(--color-success) 30%, transparent)' }}>
                            Linked
                          </Badge>
                        )}
                        {linked?.isPrimary && (
                          <Badge className="text-[10px] h-4 px-1.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)', border: '1px solid color-mix(in oklch, var(--color-primary) 30%, transparent)' }}>
                            Primary
                          </Badge>
                        )}
                      </div>
                      {isLinked && linked && (
                        <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.75 }}>
                          Linked {new Date(linked.linkedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {isLinked ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setUnlinkProvider(ap.id); setUnlinkDialogOpen(true); }}
                        disabled={unlinking === ap.id}
                        className="h-7 text-[11px] shrink-0"
                        style={{ color: 'var(--color-destructive)' }}
                      >
                        {unlinking === ap.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Unlink className="w-3.5 h-3.5 mr-1" />Unlink</>}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLinkProvider(ap.id)}
                        disabled={linking === ap.id}
                        className="h-7 text-[11px] shrink-0"
                      >
                        {linking === ap.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Link2 className="w-3.5 h-3.5 mr-1" />Link</>}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Primary method selector */}
            {providers.length > 0 && (
              <div className="pt-1 space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Primary Login Method</p>
                <Select value={primaryLoginMethod} onValueChange={handleSetPrimary}>
                  <SelectTrigger className="h-9 text-[13px]" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email / Password</SelectItem>
                    {providers.map(p => (
                      <SelectItem key={p.providerId} value={p.providerId}>{getProviderName(p.providerId)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.75 }}>
                  Used as the default sign-in method.
                </p>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── Unlink Confirmation ─────────────────────────────────────────── */}
      <Dialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-foreground)' }}>Unlink {unlinkProvider ? getProviderName(unlinkProvider) : 'Provider'}?</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>
              You&apos;ll no longer be able to sign in with this provider. You can re-link it at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setUnlinkDialogOpen(false); setUnlinkProvider(null); }} className="text-[12px]">Cancel</Button>
            <Button size="sm" onClick={() => unlinkProvider && handleUnlinkProvider(unlinkProvider)} disabled={!unlinkProvider || unlinking === unlinkProvider} className="text-[12px]" style={{ backgroundColor: 'var(--color-destructive)', color: 'white' }}>
              {unlinking === unlinkProvider ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5 mr-1.5" />}
              Unlink
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Suppress unused import hint
const _unused = CheckCircle2;
void _unused;
