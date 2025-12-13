'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Calendar,
  RefreshCw,
  Link2,
  Unlink,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useHousehold } from '@/contexts/household-context';
import { signIn } from '@/lib/better-auth-client';

interface CalendarConnection {
  id: string;
  provider: 'google' | 'ticktick';
  calendarId: string | null;
  calendarName: string | null;
  isActive: boolean;
  createdAt: string;
}

interface SyncSettings {
  syncMode: 'direct' | 'budget_period';
  syncBills: boolean;
  syncSavingsMilestones: boolean;
  syncDebtMilestones: boolean;
  syncPayoffDates: boolean;
  syncGoalTargetDates: boolean;
  reminderMinutes: number | null;
  lastFullSyncAt: string | null;
}

interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
}

interface GoogleStatus {
  configured: boolean;
  linked: boolean;
  calendars: GoogleCalendar[];
  selectedCalendarId: string | null;
  selectedCalendarName: string | null;
  connectionId: string | null;
  error?: string;
  message?: string;
}

interface TickTickProject {
  id: string;
  name: string;
  color?: string;
}

export function CalendarSyncSection() {
  const { selectedHouseholdId } = useHousehold();
  
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [settings, setSettings] = useState<SyncSettings>({
    syncMode: 'direct',
    syncBills: true,
    syncSavingsMilestones: true,
    syncDebtMilestones: true,
    syncPayoffDates: true,
    syncGoalTargetDates: true,
    reminderMinutes: 1440,
    lastFullSyncAt: null,
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [enabling, setEnabling] = useState(false);
  
  // Google OAuth status
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({
    configured: false,
    linked: false,
    calendars: [],
    selectedCalendarId: null,
    selectedCalendarName: null,
    connectionId: null,
  });
  
  // Calendar selection state (for Google)
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  
  // Project selection state (for TickTick)
  const [projects, setProjects] = useState<TickTickProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const fetchGoogleStatus = useCallback(async () => {
    if (!selectedHouseholdId) return;
    
    try {
      const response = await fetch(
        `/api/calendar-sync/google/status?householdId=${selectedHouseholdId}`,
        { credentials: 'include' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setGoogleStatus(data);
        setCalendars(data.calendars || []);
      }
    } catch (error) {
      console.error('Failed to load Google status:', error);
    }
  }, [selectedHouseholdId]);

  const fetchSettings = useCallback(async () => {
    if (!selectedHouseholdId) return;
    
    try {
      setLoading(true);
      const response = await fetch(
        `/api/calendar-sync/settings?householdId=${selectedHouseholdId}`,
        { credentials: 'include' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections || []);
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Failed to load calendar sync settings:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId]);

  useEffect(() => {
    fetchGoogleStatus();
    fetchSettings();
  }, [fetchGoogleStatus, fetchSettings]);

  // Handle linking Google account via Better Auth
  const handleLinkGoogle = () => {
    // Redirect to Better Auth Google OAuth
    signIn.social({
      provider: 'google',
      callbackURL: window.location.href,
    });
  };

  // Handle enabling Google Calendar sync (after Google is already linked)
  const handleEnableGoogleSync = async () => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household first');
      return;
    }

    try {
      setEnabling(true);
      const response = await fetch('/api/calendar-sync/google/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ householdId: selectedHouseholdId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to enable calendar sync');
      }

      toast.success('Google Calendar sync enabled');
      fetchGoogleStatus();
      fetchSettings();
    } catch (error) {
      console.error('Error enabling Google Calendar:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to enable');
    } finally {
      setEnabling(false);
    }
  };

  // Handle TickTick connection (still uses separate OAuth)
  const handleConnectTickTick = async () => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household first');
      return;
    }

    try {
      const response = await fetch(
        `/api/calendar-sync/ticktick/connect?householdId=${selectedHouseholdId}`,
        { credentials: 'include' }
      );
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate connection');
      }

      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Error connecting to TickTick:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to connect');
    }
  };

  const handleDisconnect = async (connectionId: string, deleteEvents: boolean = false) => {
    try {
      setDisconnecting(true);
      const response = await fetch('/api/calendar-sync/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ connectionId, deleteRemoteEvents: deleteEvents }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      toast.success('Calendar sync disabled');
      fetchGoogleStatus();
      fetchSettings();
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect calendar');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSelectCalendar = async () => {
    if (!googleStatus.connectionId) return;
    
    setSelectedConnectionId(googleStatus.connectionId);
    setLoadingCalendars(true);
    setCalendarDialogOpen(true);
    setSelectedCalendarId(googleStatus.selectedCalendarId || '');

    // Calendars are already loaded from status
    setCalendars(googleStatus.calendars);
    setLoadingCalendars(false);
  };

  const handleSelectProject = async (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    setLoadingProjects(true);
    setProjectDialogOpen(true);

    try {
      const response = await fetch(
        `/api/calendar-sync/projects?connectionId=${connectionId}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
        setSelectedProjectId(data.selectedProjectId || '');
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSaveProjectSelection = async () => {
    if (!selectedConnectionId || !selectedProjectId) return;

    try {
      setSaving(true);
      const response = await fetch('/api/calendar-sync/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          connectionId: selectedConnectionId,
          projectId: selectedProjectId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save project selection');
      }

      toast.success('Project selected');
      setProjectDialogOpen(false);
      fetchSettings();
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Failed to save project selection');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCalendarSelection = async () => {
    if (!selectedConnectionId || !selectedCalendarId) return;

    try {
      setSaving(true);
      const response = await fetch('/api/calendar-sync/calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          connectionId: selectedConnectionId,
          calendarId: selectedCalendarId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save calendar selection');
      }

      toast.success('Calendar selected');
      setCalendarDialogOpen(false);
      fetchGoogleStatus();
      fetchSettings();
    } catch (error) {
      console.error('Error saving calendar:', error);
      toast.error('Failed to save calendar selection');
    } finally {
      setSaving(false);
    }
  };

  const handleSettingChange = async (key: keyof SyncSettings, value: unknown) => {
    if (!selectedHouseholdId) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      setSaving(true);
      const response = await fetch('/api/calendar-sync/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          householdId: selectedHouseholdId,
          [key]: value,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save setting');
      }

      toast.success('Setting updated');
    } catch (error) {
      console.error('Error saving setting:', error);
      toast.error('Failed to save setting');
      fetchSettings();
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!selectedHouseholdId) return;

    try {
      setSyncing(true);
      const response = await fetch('/api/calendar-sync/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ householdId: selectedHouseholdId }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          `Sync complete: ${data.created} created, ${data.updated} updated, ${data.deleted} removed`
        );
        fetchSettings();
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const googleConnection = connections.find((c) => c.provider === 'google');
  const ticktickConnection = connections.find((c) => c.provider === 'ticktick');
  const hasActiveSync = connections.length > 0 && connections.some((c) => c.calendarId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="space-y-3">
        {/* Google Calendar */}
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#4285F4]/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#4285F4]" />
              </div>
              <div>
                <h4 className="font-medium text-foreground">Google Calendar</h4>
                {!googleStatus.configured ? (
                  <span className="text-xs text-muted-foreground">Not configured</span>
                ) : !googleStatus.linked ? (
                  <span className="text-xs text-muted-foreground">Link your Google account to enable</span>
                ) : googleConnection ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-[var(--color-success)]" />
                    <span className="text-xs text-muted-foreground">
                      {googleConnection.calendarName || 'Enabled - Select a calendar'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-[var(--color-success)]" />
                    <span className="text-xs text-muted-foreground">Google account linked</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!googleStatus.configured ? (
                <Badge variant="secondary">Setup Required</Badge>
              ) : !googleStatus.linked ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLinkGoogle}
                  className="border-border"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Link Google
                </Button>
              ) : googleConnection ? (
                <>
                  {!googleConnection.calendarId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectCalendar}
                      className="border-border"
                    >
                      Select Calendar
                    </Button>
                  )}
                  {googleConnection.calendarId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectCalendar}
                      className="text-muted-foreground"
                    >
                      Change
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect(googleConnection.id)}
                    disabled={disconnecting}
                    className="text-[var(--color-error)] hover:text-[var(--color-error)]"
                  >
                    <Unlink className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEnableGoogleSync}
                  disabled={enabling}
                  className="border-border"
                >
                  {enabling ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Calendar className="w-4 h-4 mr-2" />
                  )}
                  Enable Sync
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* TickTick */}
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#4772FA]/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#4772FA]" />
              </div>
              <div>
                <h4 className="font-medium text-foreground">TickTick</h4>
                {ticktickConnection ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-[var(--color-success)]" />
                    <span className="text-xs text-muted-foreground">
                      {ticktickConnection.calendarName || 'Connected - Select a project'}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Sync to TickTick tasks</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {ticktickConnection ? (
                <>
                  {!ticktickConnection.calendarId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectProject(ticktickConnection.id)}
                      className="border-border"
                    >
                      Select Project
                    </Button>
                  )}
                  {ticktickConnection.calendarId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelectProject(ticktickConnection.id)}
                      className="text-muted-foreground"
                    >
                      Change
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect(ticktickConnection.id)}
                    disabled={disconnecting}
                    className="text-[var(--color-error)] hover:text-[var(--color-error)]"
                  >
                    <Unlink className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectTickTick}
                  className="border-border"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Connect
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Sync Settings - Only show if connected */}
      {hasActiveSync && (
        <>
          <Separator className="bg-border" />

          {/* Sync Mode */}
          <div className="space-y-3">
            <Label className="text-foreground">Sync Mode</Label>
            <div className="space-y-2">
              <Card
                className={`p-3 cursor-pointer transition-colors ${
                  settings.syncMode === 'direct'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-border bg-card hover:bg-elevated'
                }`}
                onClick={() => handleSettingChange('syncMode', 'direct')}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={settings.syncMode === 'direct'}
                    onChange={() => handleSettingChange('syncMode', 'direct')}
                    className="mt-1"
                  />
                  <div>
                    <h4 className="font-medium text-foreground">Direct dates</h4>
                    <p className="text-xs text-muted-foreground">
                      Events appear on their actual due dates
                    </p>
                  </div>
                </div>
              </Card>

              <Card
                className={`p-3 cursor-pointer transition-colors ${
                  settings.syncMode === 'budget_period'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-border bg-card hover:bg-elevated'
                }`}
                onClick={() => handleSettingChange('syncMode', 'budget_period')}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    checked={settings.syncMode === 'budget_period'}
                    onChange={() => handleSettingChange('syncMode', 'budget_period')}
                    className="mt-1"
                  />
                  <div>
                    <h4 className="font-medium text-foreground">Budget periods</h4>
                    <p className="text-xs text-muted-foreground">
                      Group events by pay period start date (based on your budget cycle settings)
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* What to Sync */}
          <div className="space-y-3">
            <Label className="text-foreground">What to Sync</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-foreground">Bill due dates</span>
                  <p className="text-xs text-muted-foreground">Upcoming and recurring bills</p>
                </div>
                <Switch
                  checked={settings.syncBills}
                  onCheckedChange={(checked) => handleSettingChange('syncBills', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-foreground">Savings goal milestones</span>
                  <p className="text-xs text-muted-foreground">25%, 50%, 75%, 100% progress</p>
                </div>
                <Switch
                  checked={settings.syncSavingsMilestones}
                  onCheckedChange={(checked) => handleSettingChange('syncSavingsMilestones', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-foreground">Debt payoff milestones</span>
                  <p className="text-xs text-muted-foreground">Track debt reduction progress</p>
                </div>
                <Switch
                  checked={settings.syncDebtMilestones}
                  onCheckedChange={(checked) => handleSettingChange('syncDebtMilestones', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-foreground">Goal target dates</span>
                  <p className="text-xs text-muted-foreground">When you plan to reach savings goals</p>
                </div>
                <Switch
                  checked={settings.syncGoalTargetDates}
                  onCheckedChange={(checked) => handleSettingChange('syncGoalTargetDates', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-foreground">Projected payoff dates</span>
                  <p className="text-xs text-muted-foreground">Estimated debt-free dates</p>
                </div>
                <Switch
                  checked={settings.syncPayoffDates}
                  onCheckedChange={(checked) => handleSettingChange('syncPayoffDates', checked)}
                />
              </div>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Reminders */}
          <div className="space-y-2">
            <Label htmlFor="reminderMinutes" className="text-foreground">Reminders</Label>
            <Select
              value={settings.reminderMinutes?.toString() || 'none'}
              onValueChange={(value) => 
                handleSettingChange('reminderMinutes', value === 'none' ? null : parseInt(value))
              }
            >
              <SelectTrigger
                id="reminderMinutes"
                className="bg-card border-border"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No reminder</SelectItem>
                <SelectItem value="60">1 hour before</SelectItem>
                <SelectItem value="1440">1 day before</SelectItem>
                <SelectItem value="2880">2 days before</SelectItem>
                <SelectItem value="10080">1 week before</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-border" />

          {/* Sync Now */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-foreground">Manual sync</span>
              {settings.lastFullSyncAt && (
                <p className="text-xs text-muted-foreground">
                  Last synced: {new Date(settings.lastFullSyncAt).toLocaleString()}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
              className="border-border"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync Now
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* No Connection Info */}
      {!hasActiveSync && (
        <Card className="p-4 bg-elevated border-border">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <h4 className="font-medium text-foreground mb-1">Sync Your Calendar</h4>
              <p className="text-sm text-muted-foreground">
                {googleStatus.linked 
                  ? 'Enable Google Calendar sync to see bill due dates, milestones, and payoff dates on your calendar.'
                  : 'Link your Google account to sync bill due dates, milestones, and payoff dates to your calendar. Events include links back to Unified Ledger for quick access.'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Calendar Selection Dialog */}
      <Dialog open={calendarDialogOpen} onOpenChange={setCalendarDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Select Calendar</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose which calendar to sync your financial events to
            </DialogDescription>
          </DialogHeader>

          {loadingCalendars ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto py-2">
              {calendars.map((cal) => (
                <Card
                  key={cal.id}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedCalendarId === cal.id
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                      : 'border-border bg-card hover:bg-elevated'
                  }`}
                  onClick={() => setSelectedCalendarId(cal.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={selectedCalendarId === cal.id}
                        onChange={() => setSelectedCalendarId(cal.id)}
                      />
                      <div>
                        <span className="text-sm font-medium text-foreground">
                          {cal.summary}
                        </span>
                        {cal.primary && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Primary
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCalendarDialogOpen(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCalendarSelection}
              disabled={!selectedCalendarId || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Select Calendar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Selection Dialog (TickTick) */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Select Project</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose which TickTick project to sync your financial events to
            </DialogDescription>
          </DialogHeader>

          {loadingProjects ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto py-2">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedProjectId === project.id
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                      : 'border-border bg-card hover:bg-elevated'
                  }`}
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={selectedProjectId === project.id}
                        onChange={() => setSelectedProjectId(project.id)}
                      />
                      <div className="flex items-center gap-2">
                        {project.color && (
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                        )}
                        <span className="text-sm font-medium text-foreground">
                          {project.name}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProjectDialogOpen(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProjectSelection}
              disabled={!selectedProjectId || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Select Project'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
