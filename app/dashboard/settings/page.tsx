'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useHousehold } from '@/contexts/household-context';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import {
  User,
  Settings,
  Lock,
  Database,
  Code,
  Home,
  Shield,
  Plus,
  Star,
  Loader2,
  Receipt,
  Bell,
  ArrowLeft,
  ChevronRight,
  Users,
  DollarSign,
} from 'lucide-react';

import { ProfileTab }             from '@/components/settings/profile-tab';
import { PreferencesTab }         from '@/components/settings/preferences-tab';
import { PrivacyTab }             from '@/components/settings/privacy-tab';
import { DataTab }                from '@/components/settings/data-tab';
import { AdvancedTab }            from '@/components/settings/advanced-tab';
import { AdminTab }               from '@/components/settings/admin-tab';
import { HouseholdMembersTab }    from '@/components/settings/household-members-tab';
import { HouseholdPreferencesTab} from '@/components/settings/household-preferences-tab';
import { HouseholdFinancialTab }  from '@/components/settings/household-financial-tab';
import { HouseholdPersonalTab }   from '@/components/settings/household-personal-tab';
import { TaxMappingTab }          from '@/components/settings/tax-mapping-tab';
import { NotificationsTab }       from '@/components/settings/notifications-tab';

const ACCOUNT_TABS = [
  { id: 'profile',      label: 'Profile',            icon: User },
  { id: 'preferences',  label: 'Preferences',         icon: Settings },
  { id: 'privacy',      label: 'Privacy & Security',  icon: Lock },
  { id: 'data',         label: 'Data Management',     icon: Database },
  { id: 'advanced',     label: 'Advanced',            icon: Code },
];

const HOUSEHOLD_TABS = [
  { id: 'members',                label: 'Members & Access',       icon: Users },
  { id: 'household-preferences',  label: 'Household Preferences',  icon: Settings },
  { id: 'household-financial',    label: 'Financial Settings',     icon: DollarSign },
  { id: 'tax-mappings',           label: 'Tax Mappings',           icon: Receipt },
  { id: 'personal',               label: 'Personal Preferences',   icon: User },
  { id: 'notifications',          label: 'Notifications',          icon: Bell },
];

// ── Sidebar nav item ──────────────────────────────────────────────────────────
function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors text-[12px]"
      style={{
        backgroundColor: active ? 'color-mix(in oklch, var(--color-primary) 10%, transparent)' : 'transparent',
        color: active ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={e => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 80%, transparent)';
      }}
      onMouseLeave={e => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
      }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ opacity: active ? 1 : 0.6 }} />
      <span className="truncate">{label}</span>
    </button>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────
function SettingsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { households, selectedHouseholdId, refreshHouseholds, loading: householdsLoading } = useHousehold();
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/admin/check-owner', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { isOwner: false })
      .then(d => setIsOwner(d.isOwner === true))
      .catch(() => setIsOwner(false));
  }, []);

  useEffect(() => {
    if (households.length === 0) return;
    const counts: Record<string, number> = {};
    Promise.all(
      households.map(async h => {
        try {
          const r = await fetch(`/api/households/${h.id}/members`, { credentials: 'include' });
          if (r.ok) counts[h.id] = (await r.json()).length;
        } catch { /* silent */ }
      })
    ).then(() => setMemberCounts(counts));
  }, [households]);

  const accountTabs = [
    ...ACCOUNT_TABS,
    ...(isOwner === true ? [{ id: 'admin', label: 'Admin', icon: Shield }] : []),
  ];

  const section    = searchParams.get('section') || 'account';
  const householdId = searchParams.get('household') || selectedHouseholdId || (households.length > 0 ? households[0].id : null);
  const tab        = searchParams.get('tab') || (section === 'account' ? 'profile' : 'members');

  const handleTabChange = (newTab: string) => {
    if (section === 'households' && householdId) {
      router.push(`/dashboard/settings?section=${section}&household=${householdId}&tab=${newTab}`);
    } else {
      router.push(`/dashboard/settings?section=${section}&tab=${newTab}`);
    }
  };

  const handleSectionChange = (newSection: string) => {
    const defaultTab = newSection === 'account' ? 'profile' : 'members';
    if (newSection === 'households' && householdId) {
      router.push(`/dashboard/settings?section=${newSection}&household=${householdId}&tab=${defaultTab}`);
    } else {
      router.push(`/dashboard/settings?section=${newSection}&tab=${defaultTab}`);
    }
  };

  const handleHouseholdChange = (newHouseholdId: string) =>
    router.push(`/dashboard/settings?section=households&household=${newHouseholdId}&tab=members`);

  const handleTabKeyDown = (
    e: React.KeyboardEvent,
    currentTab: string,
    allTabs: typeof accountTabs
  ) => {
    const ids = allTabs.map(t => t.id);
    const ci = ids.indexOf(currentTab);
    let ni = ci;
    if (e.key === 'ArrowRight') ni = (ci + 1) % ids.length;
    else if (e.key === 'ArrowLeft') ni = (ci - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') ni = 0;
    else if (e.key === 'End') ni = ids.length - 1;
    else return;
    e.preventDefault();
    handleTabChange(ids[ni]);
  };

  async function createHousehold() {
    const name = householdName.trim();
    if (!name) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const hh = await res.json();
        toast.success('Household created');
        await refreshHouseholds();
        setCreateDialogOpen(false);
        setHouseholdName('');
        if (hh?.id) router.push(`/dashboard/settings?section=households&household=${hh.id}&tab=members`);
      } else {
        const d = await res.json().catch(() => ({ error: 'Failed' }));
        toast.error(d?.error || 'Failed to create household');
      }
    } catch { toast.error('Failed to create household'); }
    finally { setSubmitting(false); }
  }

  async function toggleFavorite(hId: string, current: boolean, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/households/${hId}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !current }),
      });
      await refreshHouseholds();
    } catch { /* silent */ }
  }

  const sortedHouseholds = [...households].sort(
    (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
  );

  const currentAccountTab = accountTabs.find(t => t.id === tab);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50">
        <div
          className="backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>

            <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
              Settings
            </h1>

            {/* Breadcrumb context */}
            {section === 'account' && currentAccountTab && (
              <>
                <span className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>·</span>
                <span className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>
                  {currentAccountTab.label}
                </span>
              </>
            )}
            {section === 'households' && (
              <>
                <span className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>·</span>
                <span className="text-[12px]" style={{ color: 'var(--color-muted-foreground)' }}>Households</span>
              </>
            )}
          </div>
        </div>
        <div
          className="h-px"
          style={{
            background: 'linear-gradient(to right, transparent 5%, var(--color-border) 20%, color-mix(in oklch, var(--color-primary) 45%, var(--color-border)) 50%, var(--color-border) 80%, transparent 95%)',
          }}
        />
      </header>

      {/* ── Account section ────────────────────────────────────────────────── */}
      {section === 'account' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex gap-6 items-start">

            {/* ── Left sidebar ────────────────────────────────────────────── */}
            <aside className="hidden lg:block w-48 shrink-0 sticky top-[57px] max-h-[calc(100vh-80px)] overflow-y-auto">
              <nav className="space-y-5 pr-1">
                {/* Account nav group */}
                <div>
                  <p
                    className="text-[9px] font-bold uppercase tracking-widest mb-2 px-2.5"
                    style={{ color: 'var(--color-primary)', opacity: 0.8 }}
                  >
                    Account
                  </p>
                  <div className="space-y-0.5">
                    {accountTabs.map(t => (
                      <NavItem
                        key={t.id}
                        icon={t.icon}
                        label={t.label}
                        active={tab === t.id}
                        onClick={() => handleTabChange(t.id)}
                      />
                    ))}
                  </div>
                </div>

                {/* Households link */}
                <div>
                  <div className="h-px mb-3" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />
                  <p
                    className="text-[9px] font-bold uppercase tracking-widest mb-2 px-2.5"
                    style={{ color: 'var(--color-muted-foreground)', opacity: 0.7 }}
                  >
                    Households
                  </p>
                  <button
                    onClick={() => handleSectionChange('households')}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors"
                    style={{ color: 'var(--color-muted-foreground)' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 80%, transparent)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                  >
                    <Home className="w-3.5 h-3.5 shrink-0" style={{ opacity: 0.6 }} />
                    <span className="text-[12px] flex-1">Manage Households</span>
                    <ChevronRight className="w-3 h-3 opacity-40 shrink-0" />
                  </button>
                </div>
              </nav>
            </aside>

            {/* ── Content area ─────────────────────────────────────────────── */}
            <main className="flex-1 min-w-0">
              {/* Mobile: dropdown tab selector */}
              <div className="lg:hidden mb-4">
                <Select
                  value={tab}
                  onValueChange={handleTabChange}
                >
                  <SelectTrigger
                    id="account-tab-select"
                    name="account-tab"
                    className="w-full text-[13px]"
                    style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTabs.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <t.icon className="w-3.5 h-3.5" />
                          <span>{t.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tab content */}
              <div
                role="tabpanel"
                aria-label={currentAccountTab?.label}
                onKeyDown={e => handleTabKeyDown(e, tab, accountTabs)}
              >
                {tab === 'profile'      && <ProfileTab />}
                {tab === 'preferences'  && <PreferencesTab />}
                {tab === 'privacy'      && <PrivacyTab />}
                {tab === 'data'         && <DataTab />}
                {tab === 'advanced'     && <AdvancedTab />}
                {isOwner === true && tab === 'admin' && <AdminTab />}
              </div>
            </main>
          </div>
        </div>
      )}

      {/* ── Households section ───────────────────────────────────────────── */}
      {section === 'households' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          {householdsLoading ? (
            <div className="flex gap-6">
              <div className="hidden lg:block w-48 space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)', animationDelay: `${i * 60}ms` }} />
                ))}
              </div>
              <div className="flex-1 h-96 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)' }} />
            </div>
          ) : households.length === 0 ? (
            /* Empty state — no households yet */
            <div className="flex gap-6">
              <aside className="hidden lg:block w-48 shrink-0 sticky top-[57px]">
                <nav className="space-y-0.5 pr-1">
                  <button
                    onClick={() => handleSectionChange('account')}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors text-[12px] mb-4"
                    style={{ color: 'var(--color-muted-foreground)' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-foreground)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)')}
                  >
                    <ArrowLeft className="w-3.5 h-3.5 shrink-0" /> Account Settings
                  </button>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-2 px-2.5" style={{ color: 'var(--color-muted-foreground)', opacity: 0.7 }}>Households</p>
                  <button
                    onClick={() => setCreateDialogOpen(true)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors text-[12px]"
                    style={{ color: 'var(--color-primary)' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-primary) 8%, transparent)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" /> <span>Create First</span>
                  </button>
                </nav>
              </aside>
              <main className="flex-1">
                <div className="rounded-xl py-14 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4" style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)' }}>
                    <Home className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <p className="font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No Households</p>
                  <p className="text-sm mb-5" style={{ color: 'var(--color-muted-foreground)' }}>Create a household to collaborate on finances with family or roommates.</p>
                  <Button onClick={() => setCreateDialogOpen(true)} size="sm" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Household
                  </Button>
                </div>
              </main>
            </div>
          ) : (
            <div className="flex gap-6 items-start">

              {/* ── Households sidebar ────────────────────────────────────── */}
              <aside className="hidden lg:block w-48 shrink-0 sticky top-[57px] max-h-[calc(100vh-80px)] overflow-y-auto">
                <nav className="space-y-4 pr-1">

                  {/* Back to Account */}
                  <button
                    onClick={() => handleSectionChange('account')}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors text-[12px]"
                    style={{ color: 'var(--color-muted-foreground)' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-foreground)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted-foreground)')}
                  >
                    <ArrowLeft className="w-3.5 h-3.5 shrink-0" /> Account Settings
                  </button>

                  {/* Household list */}
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-2 px-2.5" style={{ color: 'var(--color-muted-foreground)', opacity: 0.7 }}>
                      Households
                    </p>
                    <div className="space-y-0.5">
                      {sortedHouseholds.map(hh => {
                        const isActive = householdId === hh.id;
                        return (
                          <button
                            key={hh.id}
                            onClick={() => handleHouseholdChange(hh.id)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors group"
                            style={{
                              backgroundColor: isActive ? 'color-mix(in oklch, var(--color-primary) 10%, transparent)' : 'transparent',
                            }}
                            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 80%, transparent)'; }}
                            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                          >
                            <Star
                              className="w-3 h-3 shrink-0 cursor-pointer"
                              style={{ color: hh.isFavorite ? 'var(--color-warning)' : 'var(--color-muted-foreground)', fill: hh.isFavorite ? 'var(--color-warning)' : 'none', opacity: hh.isFavorite ? 1 : 0.4 }}
                              onClick={e => toggleFavorite(hh.id, hh.isFavorite, e)}
                            />
                            <span className="flex-1 truncate text-[12px]" style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-muted-foreground)', fontWeight: isActive ? 600 : 400 }}>
                              {hh.name}
                            </span>
                            {memberCounts[hh.id] !== undefined && (
                              <span className="text-[10px] px-1 py-0.5 rounded shrink-0" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-muted-foreground)' }}>
                                {memberCounts[hh.id]}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setCreateDialogOpen(true)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors text-[12px] mt-1"
                      style={{ color: 'var(--color-primary)', opacity: 0.8 }}
                      onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'color-mix(in oklch, var(--color-primary) 8%, transparent)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" /> <span>Create New</span>
                    </button>
                  </div>

                  {/* Household tabs (shown when a household is selected) */}
                  {householdId && (
                    <div>
                      <div className="h-px my-1" style={{ backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)' }} />
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-2 px-2.5" style={{ color: 'var(--color-primary)', opacity: 0.8 }}>
                        Settings
                      </p>
                      <div className="space-y-0.5">
                        {HOUSEHOLD_TABS.map(t => (
                          <NavItem
                            key={t.id}
                            icon={t.icon}
                            label={t.label}
                            active={tab === t.id}
                            onClick={() => handleTabChange(t.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </nav>
              </aside>

              {/* ── Content ───────────────────────────────────────────────── */}
              <main className="flex-1 min-w-0">

                {/* Mobile: selectors */}
                <div className="lg:hidden space-y-2 mb-4">
                  <Select value={householdId || ''} onValueChange={v => v === 'create-new' ? setCreateDialogOpen(true) : handleHouseholdChange(v)}>
                    <SelectTrigger id="household-select" name="household-select" className="w-full text-[13px]" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                      <SelectValue placeholder="Select household" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedHouseholds.map(hh => (
                        <SelectItem key={hh.id} value={hh.id}>
                          <div className="flex items-center gap-2">
                            <Home className="w-4 h-4" />
                            <span>{hh.name}</span>
                            {memberCounts[hh.id] !== undefined && <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>({memberCounts[hh.id]})</span>}
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="create-new">
                        <div className="flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
                          <Plus className="w-4 h-4" /> Create New Household
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {householdId && (
                    <Select value={tab} onValueChange={handleTabChange}>
                      <SelectTrigger id="household-settings-tab-select" name="household-settings-tab" className="w-full text-[13px]" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOUSEHOLD_TABS.map(t => (
                          <SelectItem key={t.id} value={t.id}>
                            <div className="flex items-center gap-2"><t.icon className="w-4 h-4" /><span>{t.label}</span></div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Tab content */}
                {householdId ? (
                  <div>
                    {tab === 'members'               && <HouseholdMembersTab householdId={householdId} />}
                    {tab === 'household-preferences' && <HouseholdPreferencesTab />}
                    {tab === 'household-financial'   && <HouseholdFinancialTab />}
                    {tab === 'tax-mappings'          && <TaxMappingTab />}
                    {tab === 'personal'              && <HouseholdPersonalTab householdId={householdId} />}
                    {tab === 'notifications'         && <NotificationsTab />}
                  </div>
                ) : (
                  <div className="rounded-xl py-12 text-center" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
                    <p className="text-[13px]" style={{ color: 'var(--color-muted-foreground)' }}>Select a household from the sidebar to manage its settings.</p>
                  </div>
                )}
              </main>
            </div>
          )}
        </div>
      )}

      {/* ── Create Household Dialog ───────────────────────────────────────── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent
          style={{
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            borderRadius: '1rem',
            maxWidth: '26rem',
            boxShadow: '0 24px 64px -12px color-mix(in oklch, var(--color-foreground) 18%, transparent)',
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>
              Create Household
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              Choose a name for your new household.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="create-household-name" className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted-foreground)' }}>
              Household Name
            </Label>
            <Input
              id="create-household-name"
              name="create-household-name"
              type="text"
              value={householdName}
              onChange={e => setHouseholdName(e.target.value)}
              placeholder="e.g., The Smiths"
              className="mt-1.5 h-9 text-[13px]"
              style={{ backgroundColor: 'var(--color-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
              onKeyDown={e => { if (e.key === 'Enter' && householdName.trim()) createHousehold(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setCreateDialogOpen(false); setHouseholdName(''); }}
              className="text-[13px]"
              style={{ color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}
            >
              Cancel
            </Button>
            <Button
              onClick={createHousehold}
              disabled={!householdName.trim() || submitting}
              className="text-[13px] font-medium"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
            >
              {submitting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Creating…</> : <><Plus className="w-3.5 h-3.5 mr-1.5" /> Create</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-4">
          <div className="w-24 h-6 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
          <div className="flex gap-6">
            <div className="w-48 space-y-2 hidden lg:block">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)', animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
            <div className="flex-1 h-96 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)' }} />
          </div>
        </div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
