'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

export function TwoFactorSection() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [generatingCodes, setGeneratingCodes] = useState(false);

  // Enable flow state
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  // Dialogs
  const [enableDialogOpen, setEnableDialogOpen] = useState(false);
  const [_verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [backupCodesDialogOpen, setBackupCodesDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const response = await fetch('/api/user/two-factor/status', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch 2FA status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleEnable() {
    try {
      setEnabling(true);
      const response = await fetch('/api/user/two-factor/enable', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to enable 2FA');
      }

      const data = await response.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
      setEnableDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to enable 2FA');
    } finally {
      setEnabling(false);
    }
  }

  async function handleVerify() {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit verification code');
      return;
    }

    try {
      setVerifying(true);
      const response = await fetch('/api/user/two-factor/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationCode }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Invalid verification code');
      }

      const data = await response.json();
      setBackupCodes(data.backupCodes);
      setEnableDialogOpen(false);
      setVerifyDialogOpen(false);
      setBackupCodesDialogOpen(true);
      setVerificationCode('');
      fetchStatus();
      toast.success('Two-factor authentication enabled successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid verification code');
      setVerificationCode('');
    } finally {
      setVerifying(false);
    }
  }

  async function handleDisable() {
    if (!disableCode || disableCode.length !== 6) {
      toast.error('Please enter a 6-digit verification code');
      return;
    }

    try {
      setDisabling(true);
      const response = await fetch('/api/user/two-factor/disable', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: disableCode }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disable 2FA');
      }

      setDisableDialogOpen(false);
      setDisableCode('');
      fetchStatus();
      toast.success('Two-factor authentication disabled successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid verification code');
      setDisableCode('');
    } finally {
      setDisabling(false);
    }
  }

  async function handleGenerateBackupCodes() {
    try {
      setGeneratingCodes(true);
      const response = await fetch('/api/user/two-factor/backup-codes', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate backup codes');
      }

      const data = await response.json();
      setBackupCodes(data.backupCodes);
      setBackupCodesDialogOpen(true);
      toast.success('New backup codes generated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate backup codes');
    } finally {
      setGeneratingCodes(false);
    }
  }

  function copyBackupCodes() {
    if (backupCodes) {
      const text = backupCodes.join('\n');
      navigator.clipboard.writeText(text);
      toast.success('Backup codes copied to clipboard');
    }
  }

  function downloadBackupCodes() {
    if (backupCodes) {
      const text = backupCodes.join('\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'unifiedledger-2fa-backup-codes.txt';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup codes downloaded');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Two-Factor Authentication
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Add an extra layer of security to your account by requiring a verification code from your authenticator app
        </p>
      </div>

      <Card className="p-4 bg-elevated border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {status?.enabled ? (
                <>
                  <ShieldCheck className="w-5 h-5 text-[var(--color-success)]" />
                  <span className="font-medium text-foreground">Enabled</span>
                  <Badge className="bg-[var(--color-success)] text-white">Active</Badge>
                </>
              ) : (
                <>
                  <ShieldOff className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium text-foreground">Disabled</span>
                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                    Inactive
                  </Badge>
                </>
              )}
            </div>

            {status?.enabled && status.verifiedAt && (
              <p className="text-sm text-muted-foreground">
                Enabled on {new Date(status.verifiedAt).toLocaleDateString()}
              </p>
            )}

            {status?.enabled && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <KeyRound className="w-4 h-4" />
                  <span>
                    {status.backupCodesCount > 0
                      ? `${status.backupCodesCount} backup codes remaining`
                      : 'No backup codes remaining'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {status?.enabled ? (
              <>
                {status.backupCodesCount === 0 && (
                  <Button
                    variant="outline"
                    onClick={handleGenerateBackupCodes}
                    disabled={generatingCodes}
                    className="border-border"
                  >
                    {generatingCodes ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <KeyRound className="w-4 h-4 mr-2" />
                    )}
                    Generate Codes
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setDisableDialogOpen(true)}
                  className="border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                >
                  <ShieldOff className="w-4 h-4 mr-2" />
                  Disable
                </Button>
              </>
            ) : (
              <Button onClick={handleEnable} disabled={enabling}>
                {enabling ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                Enable 2FA
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Enable Dialog with QR Code */}
      <Dialog open={enableDialogOpen} onOpenChange={setEnableDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {qrCode && (
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-lg border-2 border-border">
                  <QRCodeSVG value={otpauthUrl || ''} size={200} />
                </div>
                {secret && (
                  <div className="w-full">
                    <Label className="text-foreground text-sm mb-2 block">
                      Or enter this code manually:
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={secret}
                        readOnly
                        className="bg-elevated border-border font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(secret);
                          toast.success('Secret copied to clipboard');
                        }}
                        className="border-border"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="verificationCode" className="text-foreground">
                Enter verification code from your app
              </Label>
              <Input
                id="verificationCode"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="mt-1 bg-elevated border-border text-center text-2xl font-mono tracking-widest"
                autoComplete="one-time-code"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEnableDialogOpen(false)} className="border-border">
              Cancel
            </Button>
            <Button onClick={handleVerify} disabled={verifying || verificationCode.length !== 6}>
              {verifying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={backupCodesDialogOpen} onOpenChange={setBackupCodesDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[var(--color-warning)]" />
              Save Your Backup Codes
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              These codes can be used to access your account if you lose access to your authenticator app. Save them in a safe place.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {backupCodes && (
              <div className="space-y-2">
                <div className="p-4 bg-elevated border border-border rounded-lg">
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                    {backupCodes.map((code, index) => (
                      <div key={index} className="p-2 bg-background rounded text-center">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={copyBackupCodes}
                    className="flex-1 border-border"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    onClick={downloadBackupCodes}
                    className="flex-1 border-border"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setBackupCodesDialogOpen(false)}>
              I&apos;ve Saved These Codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Disable Two-Factor Authentication?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This will reduce the security of your account. You&apos;ll need to enter a verification code from your authenticator app to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="disableCode" className="text-foreground">
              Enter verification code
            </Label>
            <Input
              id="disableCode"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="mt-1 bg-elevated border-border text-center text-2xl font-mono tracking-widest"
              autoComplete="one-time-code"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDisableDialogOpen(false);
                setDisableCode('');
              }}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDisable}
              disabled={disabling || disableCode.length !== 6}
              className="bg-[var(--color-error)] hover:bg-[var(--color-error)]/90"
            >
              {disabling ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ShieldOff className="w-4 h-4 mr-2" />
              )}
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

