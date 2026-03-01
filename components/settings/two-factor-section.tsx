'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Download,
  Copy,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

interface TwoFactorStatus {
  enabled: boolean;
  verifiedAt: string | null;
  backupCodesCount: number;
  isSetupComplete: boolean;
}

// ── Shared helper (mirrors profile-tab Section pattern) ──────────────────────
function Section({
  icon: Icon,
  label,
  accent = 'var(--color-primary)',
  badge,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  accent?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)', backgroundColor: 'color-mix(in oklch, var(--color-elevated) 55%, transparent)', borderLeft: `3px solid ${accent}` }}>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent, opacity: 0.85 }} />}
        <span className="text-[11px] font-semibold uppercase tracking-widest flex-1" style={{ color: accent }}>{label}</span>
        {badge}
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TwoFactorSection() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [generatingCodes, setGeneratingCodes] = useState(false);

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const [enableDialogOpen, setEnableDialogOpen] = useState(false);
  const [backupCodesDialogOpen, setBackupCodesDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  useEffect(() => { fetchStatus(); }, []);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/user/two-factor/status', { credentials: 'include' });
      if (res.ok) setStatus(await res.json());
    } catch (e) { console.error('Failed to fetch 2FA status:', e); }
    finally { setLoading(false); }
  }

  async function handleEnable() {
    try {
      setEnabling(true);
      const res = await fetch('/api/user/two-factor/enable', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to enable 2FA'); }
      const d = await res.json();
      setQrCode(d.qrCode); setSecret(d.secret); setOtpauthUrl(d.otpauthUrl);
      setEnableDialogOpen(true);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to enable 2FA'); }
    finally { setEnabling(false); }
  }

  async function handleVerify() {
    if (verificationCode.length !== 6) { toast.error('Please enter a 6-digit code'); return; }
    try {
      setVerifying(true);
      const res = await fetch('/api/user/two-factor/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: verificationCode }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Invalid code'); }
      const d = await res.json();
      setBackupCodes(d.backupCodes);
      setEnableDialogOpen(false);
      setBackupCodesDialogOpen(true);
      setVerificationCode('');
      fetchStatus();
      toast.success('Two-factor authentication enabled');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Invalid code'); setVerificationCode(''); }
    finally { setVerifying(false); }
  }

  async function handleDisable() {
    if (disableCode.length !== 6) { toast.error('Please enter a 6-digit code'); return; }
    try {
      setDisabling(true);
      const res = await fetch('/api/user/two-factor/disable', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: disableCode }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to disable 2FA'); }
      setDisableDialogOpen(false); setDisableCode('');
      fetchStatus();
      toast.success('Two-factor authentication disabled');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Invalid code'); setDisableCode(''); }
    finally { setDisabling(false); }
  }

  async function handleGenerateBackupCodes() {
    try {
      setGeneratingCodes(true);
      const res = await fetch('/api/user/two-factor/backup-codes', { credentials: 'include' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      const d = await res.json();
      setBackupCodes(d.backupCodes);
      setBackupCodesDialogOpen(true);
      toast.success('New backup codes generated');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to generate backup codes'); }
    finally { setGeneratingCodes(false); }
  }

  function copyBackupCodes() {
    if (backupCodes) { navigator.clipboard.writeText(backupCodes.join('\n')); toast.success('Backup codes copied'); }
  }
  function downloadBackupCodes() {
    if (backupCodes) {
      const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'unifiedledger-2fa-backup-codes.txt'; a.click();
      URL.revokeObjectURL(url);
    }
  }

  const accent = status?.enabled ? 'var(--color-success)' : 'var(--color-muted-foreground)';

  const statusBadge = loading ? null : status?.enabled ? (
    <Badge className="text-[10px] h-5 px-2 font-semibold" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 15%, transparent)', color: 'var(--color-success)', border: '1px solid color-mix(in oklch, var(--color-success) 35%, transparent)' }}>Active</Badge>
  ) : (
    <Badge className="text-[10px] h-5 px-2 font-semibold" style={{ backgroundColor: 'color-mix(in oklch, var(--color-muted-foreground) 12%, transparent)', color: 'var(--color-muted-foreground)', border: '1px solid color-mix(in oklch, var(--color-muted-foreground) 25%, transparent)' }}>Inactive</Badge>
  );

  return (
    <>
      <Section icon={Shield} label="Two-Factor Authentication" accent={accent} badge={statusBadge}>
        {loading ? (
          <div className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {status?.enabled
                  ? <ShieldCheck className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                  : <ShieldOff className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />}
                <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>
                  {status?.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {status?.enabled && (
                <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
                  <KeyRound className="w-3.5 h-3.5" />
                  {status.backupCodesCount > 0
                    ? `${status.backupCodesCount} backup codes remaining`
                    : <span style={{ color: 'var(--color-warning)' }}>No backup codes remaining</span>}
                  {status.verifiedAt && (
                    <span style={{ opacity: 0.6 }}>· Enabled {new Date(status.verifiedAt).toLocaleDateString()}</span>
                  )}
                </div>
              )}
              {!status?.enabled && (
                <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
                  Add an extra layer of security using an authenticator app.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {status?.enabled ? (
                <>
                  {status.backupCodesCount === 0 && (
                    <Button variant="outline" size="sm" onClick={handleGenerateBackupCodes} disabled={generatingCodes} className="text-[12px] h-8">
                      {generatingCodes ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5 mr-1.5" />}
                      Generate Codes
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setDisableDialogOpen(true)} className="text-[12px] h-8" style={{ borderColor: 'var(--color-destructive)', color: 'var(--color-destructive)' }}>
                    <ShieldOff className="w-3.5 h-3.5 mr-1.5" />
                    Disable
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={handleEnable} disabled={enabling} className="text-[12px] h-8" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
                  {enabling ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Shield className="w-3.5 h-3.5 mr-1.5" />}
                  Enable 2FA
                </Button>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* ── Enable / Verify Dialog ──────────────────────────────────────── */}
      <Dialog open={enableDialogOpen} onOpenChange={setEnableDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-foreground)' }}>Set Up Two-Factor Auth</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>
              Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {qrCode && (
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-white rounded-lg" style={{ border: '1px solid var(--color-border)' }}>
                  <QRCodeSVG value={otpauthUrl || ''} size={180} />
                </div>
                {secret && (
                  <div className="w-full space-y-1">
                    <Label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Manual entry code</Label>
                    <div className="flex items-center gap-2">
                      <Input value={secret} readOnly className="font-mono text-[12px] h-9" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }} />
                      <Button variant="outline" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={() => { navigator.clipboard.writeText(secret); toast.success('Copied'); }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="verificationCode" className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Verification code</Label>
              <Input
                id="verificationCode"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoComplete="one-time-code"
                className="text-center text-xl font-mono tracking-[0.4em] h-11"
                style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEnableDialogOpen(false)} className="text-[12px]">Cancel</Button>
            <Button size="sm" onClick={handleVerify} disabled={verifying || verificationCode.length !== 6} className="text-[12px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {verifying ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Backup Codes Dialog ─────────────────────────────────────────── */}
      <Dialog open={backupCodesDialogOpen} onOpenChange={setBackupCodesDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--color-foreground)' }}>
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
              Save Your Backup Codes
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>
              Store these codes in a safe place. Each can be used once to access your account if you lose your authenticator.
            </DialogDescription>
          </DialogHeader>
          {backupCodes && (
            <div className="space-y-3 py-2">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[12px]">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="px-2 py-1.5 rounded text-center" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-foreground)' }}>{code}</div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyBackupCodes} className="flex-1 text-[12px] h-8"><Copy className="w-3.5 h-3.5 mr-1.5" />Copy</Button>
                <Button variant="outline" size="sm" onClick={downloadBackupCodes} className="flex-1 text-[12px] h-8"><Download className="w-3.5 h-3.5 mr-1.5" />Download</Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button size="sm" onClick={() => setBackupCodesDialogOpen(false)} className="text-[12px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              I&apos;ve Saved These Codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Disable Dialog ──────────────────────────────────────────────── */}
      <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-foreground)' }}>Disable Two-Factor Auth?</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>
              This reduces your account security. Enter a code from your authenticator app to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label htmlFor="disableCode" className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Verification code</Label>
            <Input
              id="disableCode"
              value={disableCode}
              onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              autoComplete="one-time-code"
              className="text-center text-xl font-mono tracking-[0.4em] h-11"
              style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setDisableDialogOpen(false); setDisableCode(''); }} className="text-[12px]">Cancel</Button>
            <Button size="sm" onClick={handleDisable} disabled={disabling || disableCode.length !== 6} className="text-[12px]" style={{ backgroundColor: 'var(--color-destructive)', color: 'white' }}>
              {disabling ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5 mr-1.5" />}
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
