'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Database, Trash2, AlertTriangle, Loader2, Shield, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function DataTab() {
  const [dataRetentionYears, setDataRetentionYears] = useState('7');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false);
  const [resetDataDialogOpen, setResetDataDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const data = await response.json();
        setDataRetentionYears(data.dataRetentionYears?.toString() || '7');
      }
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveDataRetention(years: string) {
    try {
      setSaving(true);
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataRetentionYears: parseInt(years),
        }),
      });

      if (response.ok) {
        toast.success('Data retention policy updated');
        setDataRetentionYears(years);
      } else {
        toast.error('Failed to update settings');
      }
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  }

  async function clearCache() {
    try {
      // Clear browser cache, localStorage, etc.
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Clear service worker caches
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.update()));
      }

      toast.success('Cache cleared successfully');
      setClearCacheDialogOpen(false);

      // Reload page to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast.error('Failed to clear cache');
    }
  }

  async function resetAppData() {
    if (!resetPassword) {
      toast.error('Please enter your password to confirm');
      return;
    }

    if (!resetConfirmed) {
      toast.error('Please confirm that you understand this action');
      return;
    }

    try {
      setResetting(true);

      const response = await fetch('/api/user/reset-app-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: resetPassword,
          confirm: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset app data');
      }

      // Clear client-side caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();

      // Show success message with countdown
      toast.success('App data reset successfully! Logging out in 3 seconds...');

      // Close dialog
      setResetDataDialogOpen(false);
      setResetPassword('');
      setResetConfirmed(false);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    } catch (error) {
      console.error('Error resetting app data:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reset app data');
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Retention Section */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Data Retention</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure how long your transaction data is kept
        </p>

        <Card className="p-4 bg-elevated border-border">
          <div className="space-y-4">
            <div>
              <Label htmlFor="dataRetention" className="text-foreground">
                Keep transactions for
              </Label>
              <Select
                value={dataRetentionYears}
                onValueChange={saveDataRetention}
                disabled={saving}
              >
                <SelectTrigger
                  id="dataRetention"
                  className="mt-1 bg-card border-border"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 year</SelectItem>
                  <SelectItem value="3">3 years</SelectItem>
                  <SelectItem value="5">5 years</SelectItem>
                  <SelectItem value="7">7 years (recommended)</SelectItem>
                  <SelectItem value="10">10 years</SelectItem>
                  <SelectItem value="999">Forever</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Transactions older than this will be automatically archived
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Separator className="bg-border" />

      {/* Cache Management Section */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Cache Management</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Clear cached data to free up space and resolve issues
        </p>

        <Card className="p-4 bg-elevated border-border">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-foreground mb-1">Clear Cache</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Remove temporary files and cached data. The app will reload after clearing.
              </p>
              <Button
                variant="outline"
                onClick={() => setClearCacheDialogOpen(true)}
                className="border-border"
              >
                Clear Cache
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Separator className="bg-border" />

      {/* Danger Zone Section */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-error)] mb-2">Danger Zone</h3>
        <Card className="p-4 border-[var(--color-error)] bg-[var(--color-error)]/5">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-[var(--color-error)] mt-0.5" />
            <div>
              <h4 className="font-medium text-foreground mb-1">Reset App Data</h4>
              <p className="text-sm text-muted-foreground">
                Clear all app settings and cached data. Your account and financial data will not be affected.
              </p>
            </div>
          </div>

          <Button
            variant="destructive"
            onClick={() => setResetDataDialogOpen(true)}
            className="bg-[var(--color-error)] hover:bg-[var(--color-error)]/90"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Reset App Data
          </Button>
        </Card>
      </div>

      {/* Clear Cache Dialog */}
      <Dialog open={clearCacheDialogOpen} onOpenChange={setClearCacheDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Clear Cache</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This will clear all cached data and reload the application. Are you sure?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearCacheDialogOpen(false)}
              className="border-border"
            >
              Cancel
            </Button>
            <Button onClick={clearCache}>
              Clear Cache
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Data Dialog */}
      <Dialog
        open={resetDataDialogOpen}
        onOpenChange={(open) => {
          setResetDataDialogOpen(open);
          if (!open) {
            setResetPassword('');
            setResetConfirmed(false);
          }
        }}
      >
        <DialogContent className="bg-card border-[var(--color-error)] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-error)] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Reset App Data
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This action will reset your preferences to defaults. Your financial data will NOT be affected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* What will be reset */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-[var(--color-error)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                This will reset:
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• All preferences and settings</li>
                <li>• Theme selection</li>
                <li>• Saved searches and filters</li>
                <li>• Import templates</li>
                <li>• Cached data</li>
              </ul>
            </div>

            {/* What will NOT be affected */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-[var(--color-success)] flex items-center gap-2">
                <Shield className="w-4 h-4" />
                This will NOT affect:
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                <li>• Your transactions and accounts</li>
                <li>• Bills and budgets</li>
                <li>• Goals and debts</li>
                <li>• Tax records</li>
                <li>• Household data</li>
              </ul>
            </div>

            <Separator className="bg-border" />

            {/* Password confirmation */}
            <div className="space-y-2">
              <Label htmlFor="resetPassword" className="text-foreground">
                Confirm your password
              </Label>
              <Input
                id="resetPassword"
                name="resetPassword"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="bg-background border-border text-foreground"
                placeholder="Enter your password"
                disabled={resetting}
              />
              <p className="text-xs text-muted-foreground">
                Password required for security
              </p>
            </div>

            {/* Confirmation checkbox */}
            <div className="flex items-start space-x-2">
              <Checkbox
                id="resetConfirm"
                checked={resetConfirmed}
                onCheckedChange={(checked) => setResetConfirmed(checked === true)}
                disabled={resetting}
                className="mt-0.5"
              />
              <label
                htmlFor="resetConfirm"
                className="text-sm text-foreground cursor-pointer leading-tight"
              >
                I understand this will reset all my preferences and settings
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetDataDialogOpen(false)}
              className="border-border"
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={resetAppData}
              className="bg-[var(--color-error)] hover:bg-[var(--color-error)]/90"
              disabled={resetting || !resetPassword || !resetConfirmed}
            >
              {resetting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Reset App Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
