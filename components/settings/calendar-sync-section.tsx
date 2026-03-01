'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
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

// ── Shared helpers ────────────────────────────────────────────────────────────
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
      <div className="px-4 py-4 space-y-4">{children}</div>
    </div>
  );
}

function SwitchRow({ label, description, checked, onCheckedChange }: { label: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[13px]" style={{ color: 'var(--color-foreground)' }}>{label}</p>
        {description && <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.8 }}>{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CalendarSyncSection() {
  const { selectedHouseholdId, postWithHousehold, putWithHousehold } = useHouseholdFetch();
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

  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({ configured: false, linked: false, calendars: [], selectedCalendarId: null, selectedCalendarName: null, connectionId: null });

  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');

  const [projects, setProjects] = useState<TickTickProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const fetchGoogleStatus = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      const res = await fetch('/api/calendar-sync/google/status', { headers: { 'x-household-id': selectedHouseholdId }, credentials: 'include' });
      if (res.ok) { const d = await res.json(); setGoogleStatus(d); setCalendars(d.calendars || []); }
    } catch (e) { console.error('Failed to load Google status:', e); }
  }, [selectedHouseholdId]);

  const fetchSettings = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      setLoading(true);
      const res = await fetch('/api/calendar-sync/settings', { headers: { 'x-household-id': selectedHouseholdId }, credentials: 'include' });
      if (res.ok) { const d = await res.json(); setConnections(d.connections || []); if (d.settings) setSettings(d.settings); }
    } catch (e) { console.error('Failed to load calendar sync settings:', e); }
    finally { setLoading(false); }
  }, [selectedHouseholdId]);

  useEffect(() => { fetchGoogleStatus(); fetchSettings(); }, [fetchGoogleStatus, fetchSettings]);

  const handleLinkGoogle = () => signIn.social({ provider: 'google', callbackURL: window.location.href });

  const handleEnableGoogleSync = async () => {
    if (!selectedHouseholdId) { toast.error('Please select a household first'); return; }
    try {
      setEnabling(true);
      const res = await postWithHousehold('/api/calendar-sync/google/enable', {});
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to enable'); }
      toast.success('Google Calendar sync enabled');
      fetchGoogleStatus(); fetchSettings();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to enable'); }
    finally { setEnabling(false); }
  };

  const handleConnectTickTick = async () => {
    if (!selectedHouseholdId) { toast.error('Please select a household first'); return; }
    try {
      const res = await fetch('/api/calendar-sync/ticktick/connect', { headers: { 'x-household-id': selectedHouseholdId }, credentials: 'include' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      const d = await res.json(); window.location.href = d.authUrl;
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to connect'); }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      setDisconnecting(true);
      const res = await fetch('/api/calendar-sync/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ connectionId, deleteRemoteEvents: false }) });
      if (!res.ok) throw new Error('Failed to disconnect');
      toast.success('Calendar sync disabled');
      fetchGoogleStatus(); fetchSettings();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to disconnect'); }
    finally { setDisconnecting(false); }
  };

  const handleSelectCalendar = () => {
    if (!googleStatus.connectionId) return;
    setSelectedConnectionId(googleStatus.connectionId);
    setCalendars(googleStatus.calendars);
    setSelectedCalendarId(googleStatus.selectedCalendarId || '');
    setLoadingCalendars(false);
    setCalendarDialogOpen(true);
  };

  const handleSelectProject = async (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    setLoadingProjects(true);
    setProjectDialogOpen(true);
    try {
      const res = await fetch(`/api/calendar-sync/projects?connectionId=${connectionId}`, { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setProjects(d.projects || []); setSelectedProjectId(d.selectedProjectId || ''); }
    } catch (e) { console.error('Error loading projects:', e); toast.error('Failed to load projects'); }
    finally { setLoadingProjects(false); }
  };

  const handleSaveCalendarSelection = async () => {
    if (!selectedConnectionId || !selectedCalendarId) return;
    try {
      setSaving(true);
      const res = await fetch('/api/calendar-sync/calendars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ connectionId: selectedConnectionId, calendarId: selectedCalendarId }) });
      if (!res.ok) throw new Error('Failed to save calendar selection');
      toast.success('Calendar selected');
      setCalendarDialogOpen(false);
      fetchGoogleStatus(); fetchSettings();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleSaveProjectSelection = async () => {
    if (!selectedConnectionId || !selectedProjectId) return;
    try {
      setSaving(true);
      const res = await fetch('/api/calendar-sync/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ connectionId: selectedConnectionId, projectId: selectedProjectId }) });
      if (!res.ok) throw new Error('Failed to save project selection');
      toast.success('Project selected');
      setProjectDialogOpen(false);
      fetchSettings();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleSettingChange = async (key: keyof SyncSettings, value: unknown) => {
    if (!selectedHouseholdId) return;
    setSettings(prev => ({ ...prev, [key]: value }));
    try {
      setSaving(true);
      const res = await putWithHousehold('/api/calendar-sync/settings', { [key]: value });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Setting updated');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save'); fetchSettings(); }
    finally { setSaving(false); }
  };

  const handleSync = async () => {
    if (!selectedHouseholdId) return;
    try {
      setSyncing(true);
      const res = await postWithHousehold('/api/calendar-sync/sync', {});
      const d = await res.json();
      if (res.ok) { toast.success(`Sync complete: ${d.created} created, ${d.updated} updated, ${d.deleted} removed`); fetchSettings(); }
      else throw new Error(d.error || 'Sync failed');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Sync failed'); }
    finally { setSyncing(false); }
  };

  const googleConnection = connections.find(c => c.provider === 'google');
  const ticktickConnection = connections.find(c => c.provider === 'ticktick');
  const hasActiveSync = connections.length > 0 && connections.some(c => c.calendarId);

  if (loading) {
    return <div className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }} />;
  }

  const sel = (id: string) => ({ id, name: id, className: 'h-9 text-[13px]', style: { backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' } });

  return (
    <>
      {/* ── Provider connections ──────────────────────────────────────── */}
      <Section icon={Calendar} label="Calendar Connections" accent="var(--color-primary)">
        <div className="divide-y rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          {/* Google Calendar */}
          <div className="flex items-center gap-3 px-3 py-2.5" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(66,133,244,0.12)', border: '1px solid rgba(66,133,244,0.2)' }}>
              <Calendar className="w-3.5 h-3.5" style={{ color: '#4285F4' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Google Calendar</span>
                {googleConnection?.calendarId && (
                  <Badge className="text-[10px] h-4 px-1.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 15%, transparent)', color: 'var(--color-success)', border: '1px solid color-mix(in oklch, var(--color-success) 30%, transparent)' }}>
                    <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />{googleConnection.calendarName || 'Active'}
                  </Badge>
                )}
              </div>
              <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.8 }}>
                {!googleStatus.configured ? 'Admin setup required' : !googleStatus.linked ? 'Link your Google account to enable' : googleConnection ? (googleConnection.calendarId ? '' : 'Select a calendar to continue') : 'Google account linked'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!googleStatus.configured ? (
                <Badge className="text-[10px] h-5 px-2" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 15%, transparent)', color: 'var(--color-warning)', border: '1px solid color-mix(in oklch, var(--color-warning) 25%, transparent)' }}>Setup Required</Badge>
              ) : !googleStatus.linked ? (
                <Button variant="outline" size="sm" onClick={handleLinkGoogle} className="h-7 text-[11px]"><Link2 className="w-3.5 h-3.5 mr-1" />Link Google</Button>
              ) : googleConnection ? (
                <>
                  <Button variant="ghost" size="sm" onClick={handleSelectCalendar} className="h-7 text-[11px]">{googleConnection.calendarId ? 'Change' : 'Select Calendar'}</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDisconnect(googleConnection.id)} disabled={disconnecting} className="h-7 w-7 p-0"><Unlink className="w-3.5 h-3.5" style={{ color: 'var(--color-destructive)' }} /></Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={handleEnableGoogleSync} disabled={enabling} className="h-7 text-[11px]">
                  {enabling ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Calendar className="w-3.5 h-3.5 mr-1" />}
                  Enable Sync
                </Button>
              )}
            </div>
          </div>

          {/* TickTick */}
          <div className="flex items-center gap-3 px-3 py-2.5" style={{ backgroundColor: 'var(--color-elevated)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(71,114,250,0.12)', border: '1px solid rgba(71,114,250,0.2)' }}>
              <Calendar className="w-3.5 h-3.5" style={{ color: '#4772FA' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>TickTick</span>
                {ticktickConnection?.calendarId && (
                  <Badge className="text-[10px] h-4 px-1.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-success) 15%, transparent)', color: 'var(--color-success)', border: '1px solid color-mix(in oklch, var(--color-success) 30%, transparent)' }}>
                    <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />{ticktickConnection.calendarName || 'Active'}
                  </Badge>
                )}
              </div>
              <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.8 }}>
                {ticktickConnection ? (ticktickConnection.calendarId ? '' : 'Select a project to continue') : 'Sync financial events to TickTick tasks'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {ticktickConnection ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => handleSelectProject(ticktickConnection.id)} className="h-7 text-[11px]">{ticktickConnection.calendarId ? 'Change' : 'Select Project'}</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDisconnect(ticktickConnection.id)} disabled={disconnecting} className="h-7 w-7 p-0"><Unlink className="w-3.5 h-3.5" style={{ color: 'var(--color-destructive)' }} /></Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={handleConnectTickTick} className="h-7 text-[11px]"><Link2 className="w-3.5 h-3.5 mr-1" />Connect</Button>
              )}
            </div>
          </div>
        </div>

        {!hasActiveSync && (
          <div className="flex items-start gap-3 px-3 py-3 rounded-lg" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 6%, transparent)', border: '1px solid color-mix(in oklch, var(--color-primary) 20%, transparent)' }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
            <p className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
              {googleStatus.linked ? 'Enable Google Calendar sync to see bill due dates and milestones on your calendar.' : 'Link your Google account or connect TickTick to sync financial events to your calendar.'}
            </p>
          </div>
        )}
      </Section>

      {/* ── Sync settings (only when connected) ──────────────────────── */}
      {hasActiveSync && (
        <Section icon={RefreshCw} label="Sync Settings" accent="var(--color-primary)">
          {/* Sync mode */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Sync Mode</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { value: 'direct', label: 'Direct dates', desc: 'Events appear on their actual due dates' },
                { value: 'budget_period', label: 'Budget periods', desc: 'Group by pay period start date' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSettingChange('syncMode', opt.value)}
                  className="text-left px-3 py-2.5 rounded-lg transition-colors"
                  style={{
                    border: `1px solid ${settings.syncMode === opt.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    backgroundColor: settings.syncMode === opt.value ? 'color-mix(in oklch, var(--color-primary) 8%, transparent)' : 'var(--color-elevated)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: settings.syncMode === opt.value ? 'var(--color-primary)' : 'var(--color-border)' }}>
                      {settings.syncMode === opt.value && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />}
                    </div>
                    <span className="text-[12px] font-medium" style={{ color: 'var(--color-foreground)' }}>{opt.label}</span>
                  </div>
                  <p className="text-[11px] pl-5" style={{ color: 'var(--color-muted-foreground)' }}>{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* What to sync */}
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>What to Sync</p>
            <SwitchRow label="Bill due dates" description="Upcoming and recurring bills" checked={settings.syncBills} onCheckedChange={v => handleSettingChange('syncBills', v)} />
            <SwitchRow label="Savings goal milestones" description="25%, 50%, 75%, 100% progress" checked={settings.syncSavingsMilestones} onCheckedChange={v => handleSettingChange('syncSavingsMilestones', v)} />
            <SwitchRow label="Debt payoff milestones" description="Track debt reduction progress" checked={settings.syncDebtMilestones} onCheckedChange={v => handleSettingChange('syncDebtMilestones', v)} />
            <SwitchRow label="Goal target dates" description="When you plan to reach savings goals" checked={settings.syncGoalTargetDates} onCheckedChange={v => handleSettingChange('syncGoalTargetDates', v)} />
            <SwitchRow label="Projected payoff dates" description="Estimated debt-free dates" checked={settings.syncPayoffDates} onCheckedChange={v => handleSettingChange('syncPayoffDates', v)} />
          </div>

          {/* Reminders */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Reminders</p>
            <Select value={settings.reminderMinutes?.toString() || 'none'} onValueChange={v => handleSettingChange('reminderMinutes', v === 'none' ? null : parseInt(v))}>
              <SelectTrigger {...sel('reminderMinutes')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No reminder</SelectItem>
                <SelectItem value="60">1 hour before</SelectItem>
                <SelectItem value="1440">1 day before</SelectItem>
                <SelectItem value="2880">2 days before</SelectItem>
                <SelectItem value="10080">1 week before</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Manual sync */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-[13px]" style={{ color: 'var(--color-foreground)' }}>Manual Sync</p>
              {settings.lastFullSyncAt && (
                <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.8 }}>
                  Last synced: {new Date(settings.lastFullSyncAt).toLocaleString()}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="text-[12px] h-8">
              {syncing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Sync Now
            </Button>
          </div>
        </Section>
      )}

      {/* ── Select Calendar dialog ────────────────────────────────────── */}
      <Dialog open={calendarDialogOpen} onOpenChange={setCalendarDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-foreground)' }}>Select Calendar</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>Choose which calendar to sync financial events to.</DialogDescription>
          </DialogHeader>
          {loadingCalendars ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-muted-foreground)' }} /></div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto py-2">
              {calendars.map(cal => (
                <button key={cal.id} type="button" onClick={() => setSelectedCalendarId(cal.id)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors"
                  style={{ border: `1px solid ${selectedCalendarId === cal.id ? 'var(--color-primary)' : 'var(--color-border)'}`, backgroundColor: selectedCalendarId === cal.id ? 'color-mix(in oklch, var(--color-primary) 8%, transparent)' : 'var(--color-elevated)' }}>
                  <div className="w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: selectedCalendarId === cal.id ? 'var(--color-primary)' : 'var(--color-border)' }}>
                    {selectedCalendarId === cal.id && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />}
                  </div>
                  <span className="text-[13px] font-medium flex-1" style={{ color: 'var(--color-foreground)' }}>{cal.summary}</span>
                  {cal.primary && <Badge className="text-[10px] h-4 px-1.5" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }}>Primary</Badge>}
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCalendarDialogOpen(false)} className="text-[12px]">Cancel</Button>
            <Button size="sm" onClick={handleSaveCalendarSelection} disabled={!selectedCalendarId || saving} className="text-[12px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Select Calendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Select Project dialog (TickTick) ──────────────────────────── */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="max-w-sm" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderRadius: '16px' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-foreground)' }}>Select Project</DialogTitle>
            <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>Choose which TickTick project to sync financial events to.</DialogDescription>
          </DialogHeader>
          {loadingProjects ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-muted-foreground)' }} /></div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto py-2">
              {projects.map(project => (
                <button key={project.id} type="button" onClick={() => setSelectedProjectId(project.id)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors"
                  style={{ border: `1px solid ${selectedProjectId === project.id ? 'var(--color-primary)' : 'var(--color-border)'}`, backgroundColor: selectedProjectId === project.id ? 'color-mix(in oklch, var(--color-primary) 8%, transparent)' : 'var(--color-elevated)' }}>
                  <div className="w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: selectedProjectId === project.id ? 'var(--color-primary)' : 'var(--color-border)' }}>
                    {selectedProjectId === project.id && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />}
                  </div>
                  {project.color && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
                  <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>{project.name}</span>
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setProjectDialogOpen(false)} className="text-[12px]">Cancel</Button>
            <Button size="sm" onClick={handleSaveProjectSelection} disabled={!selectedProjectId || saving} className="text-[12px]" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Select Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
