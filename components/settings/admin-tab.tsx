'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
  providerId: 'google' | 'github';
  clientId: string;
  clientSecret: string;
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
  enabled: boolean;
}

export function AdminTab() {
  const [googleSettings, setGoogleSettings] = useState<OAuthFormState>({
    clientId: '',
    clientSecret: '',
    enabled: false,
  });
  const [githubSettings, setGithubSettings] = useState<OAuthFormState>({
    clientId: '',
    clientSecret: '',
    enabled: false,
  });
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [savingGithub, setSavingGithub] = useState(false);
  const [refreshingSystemInfo, setRefreshingSystemInfo] = useState(false);

  useEffect(() => {
    fetchOAuthSettings();
    fetchSystemInfo();
  }, []);

  async function fetchOAuthSettings() {
    try {
      const response = await fetch('/api/admin/oauth-settings', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Access denied: Owner access required');
          return;
        }
        throw new Error('Failed to fetch OAuth settings');
      }

      const data = await response.json();
      const providers = data.providers || [];

      // Find Google and GitHub settings
      const google = providers.find((p: OAuthProvider) => p.providerId === 'google');
      const github = providers.find((p: OAuthProvider) => p.providerId === 'github');

      if (google) {
        setGoogleSettings({
          clientId: google.clientId || '',
          clientSecret: google.clientSecret || '',
          enabled: google.enabled !== false,
        });
      }

      if (github) {
        setGithubSettings({
          clientId: github.clientId || '',
          clientSecret: github.clientSecret || '',
          enabled: github.enabled !== false,
        });
      }
    } catch (error) {
      console.error('Error fetching OAuth settings:', error);
      toast.error('Failed to load OAuth settings');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSystemInfo() {
    try {
      const response = await fetch('/api/admin/system-info', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          return; // Silently fail if not owner
        }
        throw new Error('Failed to fetch system info');
      }

      const data = await response.json();
      setSystemInfo(data);
    } catch (error) {
      console.error('Error fetching system info:', error);
      // Don't show toast for system info errors (less critical)
    }
  }

  async function saveOAuthSettings(providerId: 'google' | 'github', settings: OAuthFormState) {
    if (!settings.clientId || !settings.clientSecret) {
      toast.error('Client ID and Client Secret are required');
      return;
    }

    const setSaving = providerId === 'google' ? setSavingGoogle : setSavingGithub;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/oauth-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          providerId,
          clientId: settings.clientId,
          clientSecret: settings.clientSecret,
          enabled: settings.enabled,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Access denied: Owner access required');
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save OAuth settings');
      }

      toast.success(`${providerId === 'google' ? 'Google' : 'GitHub'} OAuth settings saved successfully`);
      
      // Note: Server restart required for changes to take effect
      toast.info('Note: Server restart required for OAuth changes to take effect', {
        duration: 5000,
      });
    } catch (error) {
      console.error(`Error saving ${providerId} OAuth settings:`, error);
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to save ${providerId === 'google' ? 'Google' : 'GitHub'} OAuth settings`
      );
    } finally {
      setSaving(false);
    }
  }

  async function refreshSystemInfo() {
    setRefreshingSystemInfo(true);
    try {
      await fetchSystemInfo();
      toast.success('System information refreshed');
    } catch (_error) {
      toast.error('Failed to refresh system information');
    } finally {
      setRefreshingSystemInfo(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* OAuth Configuration */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-foreground" />
            <CardTitle className="text-foreground">OAuth Configuration</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Configure OAuth providers for social login. Changes require a server restart to take effect.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Google OAuth */}
          <div className="space-y-4 p-4 bg-elevated rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-[var(--color-primary)] flex items-center justify-center text-white font-bold">
                  G
                </div>
                <Label className="text-foreground font-medium">Google OAuth</Label>
              </div>
              <div className="flex items-center gap-2">
                {googleSettings.enabled ? (
                  <Badge className="bg-[var(--color-success)] text-white">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                    <XCircle className="w-3 h-3 mr-1" />
                    Disabled
                  </Badge>
                )}
                <Switch
                  checked={googleSettings.enabled}
                  onCheckedChange={(checked) =>
                    setGoogleSettings((prev) => ({ ...prev, enabled: checked }))
                  }
                />
              </div>
            </div>
            <Separator className="bg-border" />
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="google-client-id" className="text-foreground">
                  Client ID
                </Label>
                <Input
                  id="google-client-id"
                  type="text"
                  value={googleSettings.clientId}
                  onChange={(e) =>
                    setGoogleSettings((prev) => ({ ...prev, clientId: e.target.value }))
                  }
                  placeholder="Enter Google Client ID"
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="google-client-secret" className="text-foreground">
                  Client Secret
                </Label>
                <Input
                  id="google-client-secret"
                  type="password"
                  value={googleSettings.clientSecret}
                  onChange={(e) =>
                    setGoogleSettings((prev) => ({ ...prev, clientSecret: e.target.value }))
                  }
                  placeholder="Enter Google Client Secret"
                  className="bg-background border-border text-foreground"
                />
              </div>
              <Button
                onClick={() => saveOAuthSettings('google', googleSettings)}
                disabled={savingGoogle || !googleSettings.clientId || !googleSettings.clientSecret}
                className="bg-[var(--color-primary)] hover:opacity-90 text-white"
              >
                {savingGoogle ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Google Settings'
                )}
              </Button>
            </div>
          </div>

          {/* GitHub OAuth */}
          <div className="space-y-4 p-4 bg-elevated rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-gray-900 dark:bg-gray-100 flex items-center justify-center text-white dark:text-gray-900 font-bold">
                  GH
                </div>
                <Label className="text-foreground font-medium">GitHub OAuth</Label>
              </div>
              <div className="flex items-center gap-2">
                {githubSettings.enabled ? (
                  <Badge className="bg-[var(--color-success)] text-white">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                    <XCircle className="w-3 h-3 mr-1" />
                    Disabled
                  </Badge>
                )}
                <Switch
                  checked={githubSettings.enabled}
                  onCheckedChange={(checked) =>
                    setGithubSettings((prev) => ({ ...prev, enabled: checked }))
                  }
                />
              </div>
            </div>
            <Separator className="bg-border" />
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="github-client-id" className="text-foreground">
                  Client ID
                </Label>
                <Input
                  id="github-client-id"
                  type="text"
                  value={githubSettings.clientId}
                  onChange={(e) =>
                    setGithubSettings((prev) => ({ ...prev, clientId: e.target.value }))
                  }
                  placeholder="Enter GitHub Client ID"
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="github-client-secret" className="text-foreground">
                  Client Secret
                </Label>
                <Input
                  id="github-client-secret"
                  type="password"
                  value={githubSettings.clientSecret}
                  onChange={(e) =>
                    setGithubSettings((prev) => ({ ...prev, clientSecret: e.target.value }))
                  }
                  placeholder="Enter GitHub Client Secret"
                  className="bg-background border-border text-foreground"
                />
              </div>
              <Button
                onClick={() => saveOAuthSettings('github', githubSettings)}
                disabled={savingGithub || !githubSettings.clientId || !githubSettings.clientSecret}
                className="bg-[var(--color-primary)] hover:opacity-90 text-white"
              >
                {savingGithub ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save GitHub Settings'
                )}
              </Button>
            </div>
          </div>

          {/* Info Alert */}
          <div className="p-4 bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
              <div className="text-sm text-foreground">
                <p className="font-medium mb-1">Important:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>OAuth client secrets are encrypted before storage</li>
                  <li>Server restart is required for OAuth configuration changes to take effect</li>
                  <li>Ensure your OAuth redirect URLs are configured correctly in the provider settings</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-foreground" />
              <CardTitle className="text-foreground">System Information</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshSystemInfo}
              disabled={refreshingSystemInfo}
              className="border-border text-foreground hover:bg-elevated"
            >
              {refreshingSystemInfo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>
          <CardDescription className="text-muted-foreground">
            Application statistics and system metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {systemInfo ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 bg-elevated rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm text-muted-foreground">Version</Label>
                </div>
                <p className="text-lg font-semibold text-foreground">{systemInfo.version}</p>
              </div>
              <div className="p-4 bg-elevated rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm text-muted-foreground">Total Users</Label>
                </div>
                <p className="text-lg font-semibold text-foreground">{systemInfo.totalUsers}</p>
              </div>
              <div className="p-4 bg-elevated rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Home className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm text-muted-foreground">Total Households</Label>
                </div>
                <p className="text-lg font-semibold text-foreground">{systemInfo.totalHouseholds}</p>
              </div>
              <div className="p-4 bg-elevated rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm text-muted-foreground">Database Size</Label>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {systemInfo.databaseSizeFormatted}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Unable to load system information</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Management */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-foreground" />
            <CardTitle className="text-foreground">User Management</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Create, manage, and delete user accounts. Assign users to households with specific roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminUsersTab />
        </CardContent>
      </Card>
    </div>
  );
}

