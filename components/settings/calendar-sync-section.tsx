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
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useHousehold } from '@/contexts/household-context';

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
  
  // Calendar selection state
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');

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
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to load calendar sync settings:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleConnect = async (provider: 'google' | 'ticktick') => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household first');
      return;
    }

    if (provider === 'ticktick') {
      toast.info('TickTick integration coming soon!');
      return;
    }

    try {
      const response = await fetch(
        `/api/calendar-sync/google/connect?householdId=${selectedHouseholdId}`,
        { credentials: 'include' }
      );
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate connection');
      }

      const data = await response.json();
      
      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error);
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

      toast.success('Calendar disconnected');
      fetchSettings();
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Failed to disconnect calendar');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSelectCalendar = async (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    setLoadingCalendars(true);
    setCalendarDialogOpen(true);

    try {
      const response = await fetch(
        `/api/calendar-sync/calendars?connectionId=${connectionId}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        setCalendars(data.calendars || []);
        setSelectedCalendarId(data.selectedCalendarId || '');
      }
    } catch (error) {
      console.error('Error loading calendars:', error);
      toast.error('Failed to load calendars');
    } finally {
      setLoadingCalendars(false);
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
      // Revert on error
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
                {googleConnection ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-[var(--color-success)]" />
                    <span className="text-xs text-muted-foreground">
                      {googleConnection.calendarName || 'Connected - Select a calendar'}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Not connected</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {googleConnection ? (
                <>
                  {!googleConnection.calendarId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectCalendar(googleConnection.id)}
                      className="border-border"
                    >
                      Select Calendar
                    </Button>
                  )}
                  {googleConnection.calendarId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelectCalendar(googleConnection.id)}
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
                  onClick={() => handleConnect('google')}
                  className="border-border"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Connect
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* TickTick */}
        <Card className="p-4 bg-card border-border opacity-60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#4772FA]/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#4772FA]" />
              </div>
              <div>
                <h4 className="font-medium text-foreground">TickTick</h4>
                <span className="text-xs text-muted-foreground">Coming soon</span>
              </div>
            </div>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
        </Card>
      </div>

      {/* Sync Settings - Only show if connected */}
      {connections.length > 0 && connections.some((c) => c.calendarId) && (
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
      {connections.length === 0 && (
        <Card className="p-4 bg-elevated border-border">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <h4 className="font-medium text-foreground mb-1">Connect a Calendar</h4>
              <p className="text-sm text-muted-foreground">
                Connect your Google Calendar to sync bill due dates, milestones, and payoff dates. 
                Events include links back to Unified Ledger for quick access.
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
    </div>
  );
}
