'use client';

import { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
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
      <div className="px-4 py-4 space-y-0">{children}</div>
    </div>
  );
}

function SwitchRow({ id, icon: Icon, label, description, checked, onCheckedChange, disabled }: {
  id: string; icon?: React.ComponentType<{ className?: string }>; label: string; description?: string;
  checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-3" style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)' }}>
      {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />}
      <div className="flex-1">
        <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>{label}</p>
        {description && <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.8 }}>{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

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
      const res = await fetch('/api/user/settings', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setEnableAnimations(d.settings?.enableAnimations !== false);
        setExperimentalFeatures(d.settings?.experimentalFeatures || false);
      }
    } catch { toast.error('Failed to load settings'); }
    finally { setLoading(false); }
  }, []);

  const fetchDatabaseStats = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      const res = await fetchWithHousehold('/api/stats');
      if (res.ok) {
        const d = await res.json();
        setStats({ transactions: d.transactions || 0, accounts: d.accounts || 0, categories: d.categories || 0, bills: d.bills || 0, goals: d.goals || 0, debts: d.debts || 0 });
      }
    } catch (e) { console.error('Failed to fetch database stats:', e); }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => { fetchSettings(); fetchDatabaseStats(); setFeatures(getExperimentalFeatures()); }, [fetchSettings, fetchDatabaseStats]);

  async function updateSetting(key: string, value: boolean) {
    try {
      const res = await fetch('/api/user/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: value }) });
      if (res.ok) {
        toast.success('Setting updated');
        if (key === 'enableAnimations') {
          setEnableAnimations(value);
          document.documentElement.classList.toggle('reduce-motion', !value);
        }
        if (key === 'experimentalFeatures') {
          setExperimentalFeatures(value);
          await refreshExperimentalFeatures();
          window.localStorage.setItem('experimental-features-updated', Date.now().toString());
        }
      } else { toast.error('Failed to update setting'); }
    } catch { toast.error('Failed to update setting'); }
  }

  function getCategoryIcon(category: FeatureCategory) {
    switch (category) {
      case 'ui':         return <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />;
      case 'analytics':  return <BarChart3 className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />;
      case 'data':       return <Database className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />;
      case 'performance':return <Zap className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />;
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', animationDelay: `${i * 80}ms` }} />)}
      </div>
    );
  }

  const STAT_ITEMS: [keyof DatabaseStats, string][] = [
    ['transactions', 'Transactions'], ['accounts', 'Accounts'],
    ['categories', 'Categories'],    ['bills', 'Bills'],
    ['goals', 'Goals'],              ['debts', 'Debts'],
  ];

  return (
    <div className="space-y-4">

      {/* ── Developer Settings ────────────────────────────────────────── */}
      <Section icon={Code} label="Developer Settings" accent="var(--color-primary)">
        <SwitchRow id="developerMode" icon={Code} label="Developer Mode" description="Show IDs, debug info, and additional technical details throughout the app." checked={isDeveloperMode} onCheckedChange={toggleDeveloperMode} disabled={devModeLoading} />
        <SwitchRow id="enableAnimations" icon={Zap} label="Enable Animations" description="Show transitions and animations throughout the app." checked={enableAnimations} onCheckedChange={v => updateSetting('enableAnimations', v)} />
        <SwitchRow id="experimentalFeatures" icon={FlaskConical} label="Experimental Features" description="Enable access to features currently in testing." checked={experimentalFeatures} onCheckedChange={v => updateSetting('experimentalFeatures', v)} />

        {!experimentalFeatures && features.length > 0 && (
          <div className="px-3 pt-3 pb-1 space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>Available Experimental Features</p>
            <div className="space-y-1.5">
              {features.map(feature => (
                <div key={feature.id} className="flex items-start gap-2.5 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                  <div className="shrink-0 mt-0.5">{getCategoryIcon(feature.category)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[12px] font-medium" style={{ color: 'var(--color-foreground)' }}>{feature.name}</span>
                      <Badge className="text-[9px] h-4 px-1.5 uppercase" style={{ backgroundColor: `${getRiskLevelColor(feature.riskLevel)}20`, color: getRiskLevelColor(feature.riskLevel), border: `1px solid ${getRiskLevelColor(feature.riskLevel)}40` }}>
                        {feature.riskLevel} risk
                      </Badge>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--color-muted-foreground)', opacity: 0.8 }}>{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] pb-1" style={{ color: 'var(--color-muted-foreground)', opacity: 0.7 }}>Enable experimental features above to unlock these capabilities.</p>
          </div>
        )}
      </Section>

      {/* ── App Information ───────────────────────────────────────────── */}
      <Section icon={Info} label="App Information" accent="var(--color-muted-foreground)">
        {[
          { label: 'Version',     value: '1.0.0'                          },
          { label: 'Framework',   value: 'Next.js 16'                     },
          { label: 'Environment', value: process.env.NODE_ENV || 'development' },
        ].map((item, i, arr) => (
          <div key={item.label} className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: i < arr.length - 1 ? '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)' : undefined }}>
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />
              <span className="text-[13px]" style={{ color: 'var(--color-foreground)' }}>{item.label}</span>
            </div>
            <Badge className="text-[11px] h-5 px-2 font-mono" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)', border: '1px solid var(--color-border)' }}>{item.value}</Badge>
          </div>
        ))}
      </Section>

      {/* ── Database Statistics ───────────────────────────────────────── */}
      <Section icon={Database} label="Database Statistics" accent="var(--color-primary)">
        {stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-0">
            {STAT_ITEMS.map(([key, label]) => (
              <div key={key} className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)' }}>
                <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>{label}</span>
                <span className="text-[18px] font-bold tabular-nums leading-tight" style={{ color: 'var(--color-foreground)' }}>
                  {stats[key].toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-6 gap-2" style={{ color: 'var(--color-muted-foreground)' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[13px]">Loading statistics…</span>
          </div>
        )}
      </Section>

    </div>
  );
}
