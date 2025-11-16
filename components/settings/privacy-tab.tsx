'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { Separator } from '@/components/ui/separator';
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
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { TwoFactorSection } from '@/components/settings/two-factor-section';

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

export function PrivacyTab() {
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

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      // Fetch sessions
      const sessionsResponse = await fetch('/api/user/sessions', { credentials: 'include' });
      if (sessionsResponse.ok) {
        const data = await sessionsResponse.json();
        setSessions(data.sessions);
      }

      // Fetch user settings for session timeout
      const settingsResponse = await fetch('/api/user/settings', { credentials: 'include' });
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setSessionTimeout(settingsData.settings.sessionTimeout || 30);
      }
    } catch (error) {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }

  async function handleTimeoutChange(value: string) {
    const newTimeout = parseInt(value, 10);
    setSessionTimeout(newTimeout);

    try {
      setSavingTimeout(true);
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionTimeout: newTimeout }),
      });

      if (!response.ok) {
        throw new Error('Failed to save session timeout');
      }

      toast.success('Session timeout updated successfully');
    } catch (error) {
      toast.error('Failed to save session timeout');
      // Revert on error
      fetchSessions();
    } finally {
      setSavingTimeout(false);
    }
  }

  async function revokeSession(sessionId: string) {
    try {
      const response = await fetch(`/api/user/sessions/${sessionId}`, { credentials: 'include', method: 'DELETE', });

      if (response.ok) {
        toast.success('Session revoked successfully');
        fetchSessions(); // Refresh list
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to revoke session');
      }
    } catch (error) {
      toast.error('Failed to revoke session');
    }
  }

  async function revokeAllSessions() {
    try {
      const response = await fetch('/api/user/sessions/revoke-all', { credentials: 'include', method: 'POST', });

      if (response.ok) {
        toast.success('All other sessions revoked');
        fetchSessions();
      } else {
        toast.error('Failed to revoke sessions');
      }
    } catch (error) {
      toast.error('Failed to revoke sessions');
    }
  }

  async function exportAllData() {
    try {
      setExporting(true);
      const response = await fetch('/api/user/export', { credentials: 'include' });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unifiedledger-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Data exported successfully');
      } else {
        toast.error('Failed to export data');
      }
    } catch (error) {
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  }

  async function exportCSV() {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/user/export/csv?${params}`, { credentials: 'include' });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions-${startDate || 'all'}-${endDate || 'all'}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Transactions exported successfully');
        setCsvDialogOpen(false);
        setStartDate('');
        setEndDate('');
      } else {
        toast.error('Failed to export transactions');
      }
    } catch (error) {
      toast.error('Failed to export transactions');
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
      toast.error('Please type the confirmation text exactly');
      return;
    }

    if (!deletePassword) {
      toast.error('Password is required');
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: deletePassword,
          confirmation: deleteConfirmation,
        }),
      });

      if (response.ok) {
        toast.success('Account deleted. Goodbye!');
        // Redirect to home page
        setTimeout(() => {
          router.push('/');
        }, 1000);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete account');
      }
    } catch (error) {
      toast.error('Failed to delete account');
    } finally {
      setDeleting(false);
    }
  }

  function formatLastActive(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  function getCountryFlag(countryCode: string | null): string {
    if (!countryCode || countryCode.length !== 2) return '';

    try {
      const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map((char) => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    } catch {
      return '';
    }
  }

  return (
    <div className="space-y-6">
      {/* Active Sessions Section */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Active Sessions</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Manage devices where you're currently signed in
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <Card className="p-8 bg-elevated border-border text-center">
            <p className="text-muted-foreground">No active sessions found</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className="p-4 bg-elevated border-border"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {session.deviceInfo.includes('iPhone') ||
                     session.deviceInfo.includes('Android') ? (
                      <Smartphone className="w-5 h-5 text-muted-foreground mt-0.5" />
                    ) : (
                      <Monitor className="w-5 h-5 text-muted-foreground mt-0.5" />
                    )}

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">
                          {session.deviceInfo}
                        </span>
                        {session.isCurrent && (
                          <Badge
                            variant="secondary"
                            className="bg-[var(--color-success)] text-white"
                          >
                            Current
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground space-y-0.5">
                        {session.ipAddress && (
                          <div>IP: {session.ipAddress}</div>
                        )}
                        {session.location && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-help">
                                  Location: {getCountryFlag(session.countryCode)}{' '}
                                  {session.location}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="bg-card border-border">
                                <p className="text-foreground">
                                  Location is determined by IP address
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <div>Last active: {formatLastActive(session.lastActive)}</div>
                      </div>
                    </div>
                  </div>

                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeSession(session.id)}
                      className="text-[var(--color-error)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                    >
                      <LogOut className="w-4 h-4 mr-1" />
                      Revoke
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {sessions.length > 1 && (
          <Button
            variant="outline"
            onClick={revokeAllSessions}
            className="mt-4 border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Revoke All Other Sessions
          </Button>
        )}
      </div>

      <Separator className="bg-border" />

      {/* Session Security Section */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Session Security</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Automatically log out after a period of inactivity to protect your account
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sessionTimeout" className="text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Session Timeout
            </Label>
            <Select
              value={sessionTimeout.toString()}
              onValueChange={handleTimeoutChange}
              disabled={savingTimeout}
            >
              <SelectTrigger
                id="sessionTimeout"
                name="sessionTimeout"
                aria-label="Select session timeout duration"
                className="bg-background border-border text-foreground"
              >
                <SelectValue placeholder="Select timeout duration" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="15" className="text-foreground hover:bg-elevated">
                  15 minutes
                </SelectItem>
                <SelectItem value="30" className="text-foreground hover:bg-elevated">
                  30 minutes (recommended)
                </SelectItem>
                <SelectItem value="60" className="text-foreground hover:bg-elevated">
                  1 hour
                </SelectItem>
                <SelectItem value="120" className="text-foreground hover:bg-elevated">
                  2 hours
                </SelectItem>
                <SelectItem value="240" className="text-foreground hover:bg-elevated">
                  4 hours
                </SelectItem>
                <SelectItem value="480" className="text-foreground hover:bg-elevated">
                  8 hours
                </SelectItem>
                <SelectItem value="0" className="text-foreground hover:bg-elevated">
                  Never (not recommended)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {sessionTimeout === 0 ? (
                <span className="flex items-center gap-1 text-[var(--color-warning)]">
                  <AlertTriangle className="w-3 h-3" />
                  Disabling session timeout reduces account security. Only use on trusted devices.
                </span>
              ) : (
                `You'll be automatically logged out after ${sessionTimeout} ${sessionTimeout === 1 ? 'minute' : 'minutes'} of inactivity.`
              )}
            </p>
          </div>
        </div>
      </div>

      <Separator className="bg-border" />

      {/* Two-Factor Authentication Section */}
      <TwoFactorSection />

      <Separator className="bg-border" />

      {/* Data Export Section */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Data Export</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Download your data for backup or migration
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={exportAllData}
            disabled={exporting}
            className="border-border"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export All Data (JSON)
          </Button>

          <Button
            variant="outline"
            onClick={() => setCsvDialogOpen(true)}
            disabled={exporting}
            className="border-border"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Transactions (CSV)
          </Button>
        </div>
      </div>

      <Separator className="bg-border" />

      {/* Danger Zone Section */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-error)] mb-2">Danger Zone</h3>
        <Card className="p-4 border-[var(--color-error)] bg-[var(--color-error)]/5">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-[var(--color-error)] mt-0.5" />
            <div>
              <h4 className="font-medium text-foreground mb-1">Delete Account</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
          </div>

          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
            className="bg-[var(--color-error)] hover:bg-[var(--color-error)]/90"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete My Account
          </Button>
        </Card>
      </div>

      {/* CSV Export Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Export Transactions</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Select a date range for your transaction export (optional)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="startDate" className="text-foreground">Start Date</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 bg-elevated border-border"
              />
            </div>

            <div>
              <Label htmlFor="endDate" className="text-foreground">End Date</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 bg-elevated border-border"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCsvDialogOpen(false);
                setStartDate('');
                setEndDate('');
              }}
              className="border-border"
            >
              Cancel
            </Button>
            <Button onClick={exportCSV} disabled={exporting}>
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-error)]">
              Delete Account
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This action is permanent and cannot be undone. All your data will be deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="deletePassword" className="text-foreground">Password</Label>
              <Input
                id="deletePassword"
                name="deletePassword"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your password"
                className="mt-1 bg-elevated border-border"
              />
            </div>

            <div>
              <Label htmlFor="deleteConfirm" className="text-foreground">
                Type "DELETE MY ACCOUNT" to confirm
              </Label>
              <Input
                id="deleteConfirm"
                name="deleteConfirm"
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                className="mt-1 bg-elevated border-border"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletePassword('');
                setDeleteConfirmation('');
              }}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteAccount}
              disabled={
                deleteConfirmation !== 'DELETE MY ACCOUNT' || !deletePassword || deleting
              }
              className="bg-[var(--color-error)] hover:bg-[var(--color-error)]/90"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
