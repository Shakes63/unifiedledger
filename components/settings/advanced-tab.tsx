'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Code, Zap, FlaskConical, Info, Database, Loader2, Sparkles, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { useDeveloperMode } from '@/contexts/developer-mode-context';
import {
  getExperimentalFeatures,
  getRiskLevelColor,
  type ExperimentalFeature,
  type FeatureCategory,
} from '@/lib/experimental-features';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { useExperimentalFeatures } from '@/contexts/experimental-features-context';

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
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const { refresh: refreshExperimentalFeatures } = useExperimentalFeatures();
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [experimentalFeatures, setExperimentalFeatures] = useState(false);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<ExperimentalFeature[]>([]);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/user/settings', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        // API returns { settings: {...} }
        setEnableAnimations(data.settings?.enableAnimations !== false);
        setExperimentalFeatures(data.settings?.experimentalFeatures || false);
      }
    } catch (_error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDatabaseStats = useCallback(async () => {
    if (!selectedHouseholdId) return;

    try {
      // Fetch statistics from dedicated stats endpoint
      const response = await fetchWithHousehold('/api/stats');
      
      if (response.ok) {
        const data = await response.json();
        setStats({
          transactions: data.transactions || 0,
          accounts: data.accounts || 0,
          categories: data.categories || 0,
          bills: data.bills || 0,
          goals: data.goals || 0,
          debts: data.debts || 0,
        });
      } else {
        console.error('Failed to fetch database stats:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch database stats:', error);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    fetchSettings();
    fetchDatabaseStats();
    setFeatures(getExperimentalFeatures());
  }, [fetchSettings, fetchDatabaseStats]);

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
        if (key === 'experimentalFeatures') {
          setExperimentalFeatures(value);
          // Refresh the experimental features context
          await refreshExperimentalFeatures();
          // Trigger storage event for other tabs
          window.localStorage.setItem('experimental-features-updated', Date.now().toString());
        }
      } else {
        toast.error('Failed to update setting');
      }
    } catch (_error) {
      toast.error('Failed to update setting');
    }
  }

  // Helper function to get category icon
  function getCategoryIcon(category: FeatureCategory) {
    switch (category) {
      case 'ui':
        return <Sparkles className="w-4 h-4 text-muted-foreground" />;
      case 'analytics':
        return <BarChart3 className="w-4 h-4 text-muted-foreground" />;
      case 'data':
        return <Database className="w-4 h-4 text-muted-foreground" />;
      case 'performance':
        return <Zap className="w-4 h-4 text-muted-foreground" />;
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

            {/* Show available experimental features when toggle is OFF */}
            {!experimentalFeatures && features.length > 0 && (
              <>
                <Separator className="bg-border" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">
                    Available Experimental Features
                  </p>
                  <div className="space-y-2">
                    {features.map((feature) => (
                      <div
                        key={feature.id}
                        className="p-3 bg-card rounded-lg border border-border"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(feature.category)}
                            <span className="text-sm font-medium text-foreground">
                              {feature.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="text-xs"
                              style={{
                                backgroundColor: `${getRiskLevelColor(feature.riskLevel)}20`,
                                color: getRiskLevelColor(feature.riskLevel),
                                borderColor: getRiskLevelColor(feature.riskLevel)
                              }}
                            >
                              {feature.riskLevel.toUpperCase()} RISK
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Enable experimental features above to unlock these capabilities
                  </p>
                </div>
              </>
            )}
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
