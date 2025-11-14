'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Code, Zap, FlaskConical, Info, Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDeveloperMode } from '@/contexts/developer-mode-context';

interface DatabaseStats {
  transactions: number;
  accounts: number;
  categories: number;
  bills: number;
  goals: number;
  debts: number;
}

export function AdvancedTab() {
  const { isDeveloperMode, loading: devModeLoading, toggleDeveloperMode } = useDeveloperMode();
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [experimentalFeatures, setExperimentalFeatures] = useState(false);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
    fetchDatabaseStats();
  }, []);

  async function fetchSettings() {
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const data = await response.json();
        setEnableAnimations(data.enableAnimations !== false);
        setExperimentalFeatures(data.experimentalFeatures || false);
      }
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function fetchDatabaseStats() {
    try {
      // Fetch statistics from various endpoints
      const [txnRes, accountsRes, categoriesRes, billsRes, goalsRes, debtsRes] = await Promise.all([
        fetch('/api/transactions?limit=1'),
        fetch('/api/accounts?limit=1'),
        fetch('/api/categories?limit=1'),
        fetch('/api/bills?limit=1'),
        fetch('/api/savings-goals?limit=1'),
        fetch('/api/debts?limit=1'),
      ]);

      const txnData = await txnRes.json();
      const accountsData = await accountsRes.json();
      const categoriesData = await categoriesRes.json();
      const billsData = await billsRes.json();
      const goalsData = await goalsRes.json();
      const debtsData = await debtsRes.json();

      setStats({
        transactions: txnData.total || 0,
        accounts: accountsData.data?.length || 0,
        categories: categoriesData.data?.length || 0,
        bills: billsData.data?.length || 0,
        goals: goalsData.data?.length || 0,
        debts: debtsData.data?.length || 0,
      });
    } catch (error) {
      console.error('Failed to fetch database stats:', error);
    }
  }

  async function updateSetting(key: string, value: boolean) {
    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (response.ok) {
        toast.success('Setting updated');

        // Update local state
        if (key === 'enableAnimations') {
          setEnableAnimations(value);
          // Apply animation preference to document
          if (value) {
            document.documentElement.classList.remove('reduce-motion');
          } else {
            document.documentElement.classList.add('reduce-motion');
          }
        }
        if (key === 'experimentalFeatures') setExperimentalFeatures(value);
      } else {
        toast.error('Failed to update setting');
      }
    } catch (error) {
      toast.error('Failed to update setting');
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
      {/* Developer Settings Section */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Developer Settings</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Advanced options for debugging and development
        </p>

        <Card className="p-4 bg-elevated border-border">
          <div className="space-y-4">
            {/* Developer Mode */}
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3 flex-1">
                <Code className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="developerMode" className="text-foreground font-medium">
                    Developer Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Show IDs, debug information, and additional technical details throughout the app
                  </p>
                </div>
              </div>
              <Switch
                id="developerMode"
                checked={isDeveloperMode}
                onCheckedChange={toggleDeveloperMode}
                disabled={devModeLoading}
              />
            </div>

            <Separator className="bg-border" />

            {/* Enable Animations */}
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3 flex-1">
                <Zap className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="enableAnimations" className="text-foreground font-medium">
                    Enable Animations
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Show transitions and animations throughout the app
                  </p>
                </div>
              </div>
              <Switch
                id="enableAnimations"
                checked={enableAnimations}
                onCheckedChange={(checked) => updateSetting('enableAnimations', checked)}
              />
            </div>

            <Separator className="bg-border" />

            {/* Experimental Features */}
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3 flex-1">
                <FlaskConical className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="experimentalFeatures" className="text-foreground font-medium">
                    Experimental Features
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Enable access to features currently in testing
                  </p>
                </div>
              </div>
              <Switch
                id="experimentalFeatures"
                checked={experimentalFeatures}
                onCheckedChange={(checked) => updateSetting('experimentalFeatures', checked)}
              />
            </div>
          </div>
        </Card>
      </div>

      <Separator className="bg-border" />

      {/* App Information Section */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">App Information</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Version details and system information
        </p>

        <Card className="p-4 bg-elevated border-border">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Version</span>
              </div>
              <Badge variant="secondary" className="bg-card">
                1.0.0
              </Badge>
            </div>

            <Separator className="bg-border" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Framework</span>
              </div>
              <Badge variant="secondary" className="bg-card">
                Next.js 16
              </Badge>
            </div>

            <Separator className="bg-border" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Environment</span>
              </div>
              <Badge variant="secondary" className="bg-card">
                {process.env.NODE_ENV || 'development'}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      <Separator className="bg-border" />

      {/* Database Statistics Section */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Database Statistics</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Overview of your financial data
        </p>

        <Card className="p-4 bg-elevated border-border">
          {stats ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                <span className="text-sm text-muted-foreground">Transactions</span>
                <span className="text-lg font-semibold text-foreground">
                  {stats.transactions.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                <span className="text-sm text-muted-foreground">Accounts</span>
                <span className="text-lg font-semibold text-foreground">
                  {stats.accounts.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                <span className="text-sm text-muted-foreground">Categories</span>
                <span className="text-lg font-semibold text-foreground">
                  {stats.categories.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                <span className="text-sm text-muted-foreground">Bills</span>
                <span className="text-lg font-semibold text-foreground">
                  {stats.bills.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                <span className="text-sm text-muted-foreground">Goals</span>
                <span className="text-lg font-semibold text-foreground">
                  {stats.goals.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                <span className="text-sm text-muted-foreground">Debts</span>
                <span className="text-lg font-semibold text-foreground">
                  {stats.debts.toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Database className="w-5 h-5 mr-2" />
              Loading statistics...
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
