'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, Calendar, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useHousehold } from '@/contexts/household-context';

interface BackupSettings {
  id?: string;
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  format: 'json' | 'csv';
  retentionCount: number;
  emailBackups: boolean;
  lastBackupAt: string | null;
  nextBackupAt: string | null;
}

export function BackupSettingsForm() {
  const { selectedHouseholdId } = useHousehold();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [settings, setSettings] = useState<BackupSettings>({
    enabled: false,
    frequency: 'weekly',
    format: 'json',
    retentionCount: 10,
    emailBackups: false,
    lastBackupAt: null,
    nextBackupAt: null,
  });

  const fetchSettings = useCallback(async () => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/user/backup-settings', {
        headers: {
          'x-household-id': selectedHouseholdId,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      } else {
        const errorData = await response.json();
        if (errorData.error?.includes('Household')) {
          toast.error('Please select a household');
        } else {
          toast.error('Failed to load backup settings');
        }
      }
    } catch (error) {
      console.error('Failed to fetch backup settings:', error);
      toast.error('Failed to load backup settings');
    } finally {
      setLoading(false);
    }
  }, [selectedHouseholdId]);

  useEffect(() => {
    if (selectedHouseholdId) {
      fetchSettings();
    }
  }, [selectedHouseholdId, fetchSettings]);

  async function saveSettings(updates: Partial<BackupSettings>) {
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return;
    }

    try {
      setSaving(true);
      const _updatedSettings = { ...settings, ...updates };
      const response = await fetch('/api/user/backup-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-household-id': selectedHouseholdId,
        },
        credentials: 'include',
        body: JSON.stringify({
          ...updates,
          householdId: selectedHouseholdId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        toast.success('Backup settings saved');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save backup settings:', error);
      toast.error('Failed to save backup settings');
    } finally {
      setSaving(false);
    }
  }

  async function createManualBackup() {
    if (!selectedHouseholdId) {
      toast.error('Please select a household');
      return;
    }

    try {
      setCreatingBackup(true);
      const response = await fetch('/api/user/backups/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-household-id': selectedHouseholdId,
        },
        credentials: 'include',
        body: JSON.stringify({
          householdId: selectedHouseholdId,
        }),
      });

      if (response.ok) {
        const _data = await response.json();
        toast.success('Backup created successfully');
        // Refresh settings to update lastBackupAt
        fetchSettings();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to create backup');
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      toast.error('Failed to create backup');
    } finally {
      setCreatingBackup(false);
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Not scheduled';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  }

  if (!selectedHouseholdId) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <p>Please select a household to configure backup settings</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading backup settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-elevated border border-border rounded-lg">
        <div className="flex-1">
          <Label htmlFor="backup-enabled" className="text-foreground font-medium">
            Enable Automatic Backups
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            Automatically create backups of your financial data on a schedule
          </p>
        </div>
        <Switch
          id="backup-enabled"
          checked={settings.enabled}
          onCheckedChange={(checked) => saveSettings({ enabled: checked })}
          disabled={saving}
        />
      </div>

      {settings.enabled && (
        <>
          {/* Frequency Selector */}
          <div className="space-y-2">
            <Label htmlFor="backup-frequency" className="text-foreground">
              Backup Frequency
            </Label>
            <Select
              value={settings.frequency}
              onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
                saveSettings({ frequency: value })
              }
              disabled={saving}
            >
              <SelectTrigger
                id="backup-frequency"
                name="backup-frequency"
                aria-label="Select backup frequency"
                className="bg-card border-border"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="daily" className="text-foreground hover:bg-elevated">
                  Daily
                </SelectItem>
                <SelectItem value="weekly" className="text-foreground hover:bg-elevated">
                  Weekly
                </SelectItem>
                <SelectItem value="monthly" className="text-foreground hover:bg-elevated">
                  Monthly
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How often backups should be created automatically
            </p>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <Label htmlFor="backup-format" className="text-foreground">
              Backup Format
            </Label>
            <Select
              value={settings.format}
              onValueChange={(value: 'json' | 'csv') => saveSettings({ format: value })}
              disabled={saving}
            >
              <SelectTrigger
                id="backup-format"
                name="backup-format"
                aria-label="Select backup format"
                className="bg-card border-border"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="json" className="text-foreground hover:bg-elevated">
                  JSON
                </SelectItem>
                <SelectItem value="csv" className="text-foreground hover:bg-elevated" disabled>
                  CSV (Coming soon)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Format for backup files (JSON recommended)
            </p>
          </div>

          {/* Retention Count */}
          <div className="space-y-2">
            <Label htmlFor="backup-retention" className="text-foreground">
              Keep Last N Backups
            </Label>
            <Input
              id="backup-retention"
              name="backup-retention"
              type="number"
              min="1"
              max="100"
              value={settings.retentionCount}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value >= 1 && value <= 100) {
                  saveSettings({ retentionCount: value });
                }
              }}
              disabled={saving}
              className="bg-card border-border text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Number of backups to keep. Older backups will be automatically deleted (1-100)
            </p>
          </div>

          {/* Next Backup Time */}
          {settings.nextBackupAt && (
            <Card className="p-4 bg-elevated border-border">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-[var(--color-primary)]" />
                <span className="text-muted-foreground">Next backup scheduled:</span>
                <span className="font-medium text-foreground">
                  {formatDate(settings.nextBackupAt)}
                </span>
              </div>
            </Card>
          )}

          {/* Last Backup Time */}
          {settings.lastBackupAt && (
            <Card className="p-4 bg-elevated border-border">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last backup:</span>
                <span className="font-medium text-foreground">
                  {formatDate(settings.lastBackupAt)}
                </span>
              </div>
            </Card>
          )}

          {/* Manual Backup Button */}
          <div className="pt-2">
            <Button
              onClick={createManualBackup}
              disabled={creatingBackup || saving}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
            >
              {creatingBackup ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Backup...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Create Backup Now
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Manually create a backup of your financial data right now
            </p>
          </div>
        </>
      )}

      {/* Manual Backup Button (when backups disabled) */}
      {!settings.enabled && (
        <div className="pt-2">
          <Button
            onClick={createManualBackup}
            disabled={creatingBackup || saving}
            variant="outline"
            className="border-border"
          >
            {creatingBackup ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Backup...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Create Backup Now
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Create a manual backup even when automatic backups are disabled
          </p>
        </div>
      )}
    </div>
  );
}

