'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useHousehold } from '@/contexts/household-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';
import {
  User,
  Settings,
  DollarSign,
  Users,
  Lock,
  Database,
  Code,
  Home,
  Shield,
  Plus,
  Star,
  Loader2,
} from 'lucide-react';

// Import existing tab components
import { ProfileTab } from '@/components/settings/profile-tab';
import { PreferencesTab } from '@/components/settings/preferences-tab';
import { PrivacyTab } from '@/components/settings/privacy-tab';
import { DataTab } from '@/components/settings/data-tab';
import { AdvancedTab } from '@/components/settings/advanced-tab';
import { AdminTab } from '@/components/settings/admin-tab';
import { HouseholdMembersTab } from '@/components/settings/household-members-tab';
import { HouseholdPreferencesTab } from '@/components/settings/household-preferences-tab';
import { HouseholdFinancialTab } from '@/components/settings/household-financial-tab';
import { HouseholdPersonalTab } from '@/components/settings/household-personal-tab';

// Account Settings tabs (global user settings)
const ACCOUNT_TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'preferences', label: 'Preferences', icon: Settings },
  { id: 'privacy', label: 'Privacy & Security', icon: Lock },
  { id: 'data', label: 'Data Management', icon: Database },
  { id: 'advanced', label: 'Advanced', icon: Code },
];

// Household Settings tabs (for each household)
const HOUSEHOLD_TABS = [
  { id: 'members', label: 'Members & Access', icon: Users },
  { id: 'household-preferences', label: 'Household Preferences', icon: Settings },
  { id: 'household-financial', label: 'Financial Settings', icon: DollarSign },
  { id: 'personal', label: 'Personal Preferences', icon: User },
];

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { households, selectedHouseholdId, selectedHousehold, refreshHouseholds, loading: householdsLoading } = useHousehold();
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check owner status on mount
  useEffect(() => {
    async function checkOwnerStatus() {
      try {
        const response = await fetch('/api/admin/check-owner', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setIsOwner(data.isOwner === true);
        } else {
          setIsOwner(false);
        }
      } catch (error) {
        console.error('Error checking owner status:', error);
        setIsOwner(false);
      }
    }
    checkOwnerStatus();
  }, []);

  // Fetch member counts for all households
  useEffect(() => {
    async function fetchMemberCounts() {
      const counts: Record<string, number> = {};
      await Promise.all(
        households.map(async (household) => {
          try {
            const response = await fetch(`/api/households/${household.id}/members`, { credentials: 'include' });
            if (response.ok) {
              const membersData = await response.json();
              counts[household.id] = membersData.length;
            }
          } catch (error) {
            // Silently fail for member counts
          }
        })
      );
      setMemberCounts(counts);
    }

    if (households.length > 0) {
      fetchMemberCounts();
    }
  }, [households]);

  // Build ACCOUNT_TABS with conditional Admin tab
  const accountTabs = [
    ...ACCOUNT_TABS,
    ...(isOwner === true ? [{ id: 'admin', label: 'Admin', icon: Shield }] : []),
  ];

  // Get top-level section (account or households)
  const section = searchParams.get('section') || 'account';
  const householdId = searchParams.get('household') || selectedHouseholdId || (households.length > 0 ? households[0].id : null);
  
  const getDefaultTab = (section: string) => {
    if (section === 'account') return 'profile';
    return 'members';
  };
  
  const tab = searchParams.get('tab') || getDefaultTab(section);

  const handleSectionChange = (newSection: string) => {
    const defaultTab = getDefaultTab(newSection);
    if (newSection === 'households' && householdId) {
      router.push(`/dashboard/settings?section=${newSection}&household=${householdId}&tab=${defaultTab}`);
    } else {
      router.push(`/dashboard/settings?section=${newSection}&tab=${defaultTab}`);
    }
  };

  const handleTabChange = (newTab: string) => {
    if (section === 'households' && householdId) {
      router.push(`/dashboard/settings?section=${section}&household=${householdId}&tab=${newTab}`);
    } else {
      router.push(`/dashboard/settings?section=${section}&tab=${newTab}`);
    }
  };

  const handleHouseholdChange = (newHouseholdId: string) => {
    router.push(`/dashboard/settings?section=households&household=${newHouseholdId}&tab=members`);
  };

  async function createHousehold() {
    if (!householdName.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: householdName }),
      });

      if (response.ok) {
        const newHousehold = await response.json();
        await refreshHouseholds();
        setCreateDialogOpen(false);
        setHouseholdName('');
        router.push(`/dashboard/settings?section=households&household=${newHousehold.id}&tab=members`);
      }
    } catch (error) {
      console.error('Failed to create household:', error);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleFavorite(householdId: string, currentStatus: boolean, event: React.MouseEvent) {
    event.stopPropagation();

    try {
      const response = await fetch(`/api/households/${householdId}/favorite`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !currentStatus }),
      });

      if (response.ok) {
        await refreshHouseholds();
      }
    } catch (error) {
      console.error('Failed to update favorite status:', error);
    }
  }

  // Sort households by join date (oldest first)
  const sortedHouseholds = [...households].sort((a, b) =>
    new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
  );

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account settings and household configurations
          </p>
        </div>

        {/* Top-Level Tabs: Account vs Households */}
        <Tabs value={section} onValueChange={handleSectionChange} className="w-full">
          {/* Top-Level Tab List */}
          <TabsList className="grid w-full grid-cols-2 bg-elevated border border-border h-12">
            <TabsTrigger
              value="account"
              className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:text-[var(--color-primary)]"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Account</span>
              <span className="sm:hidden">Account</span>
            </TabsTrigger>
            <TabsTrigger
              value="households"
              className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:text-[var(--color-primary)]"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Households</span>
              <span className="sm:hidden">Households</span>
            </TabsTrigger>
          </TabsList>

          {/* Account Section */}
          <TabsContent value="account" className="mt-6 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Personal account settings that apply globally across all households
              </p>
            </div>

            <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
              {/* Desktop: Horizontal Tabs */}
              <TabsList className="hidden lg:flex w-full justify-start bg-elevated border border-border overflow-x-auto h-auto flex-wrap gap-1 p-2">
                {accountTabs.map((t) => (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:text-[var(--color-primary)] px-3 py-2"
                  >
                    <t.icon className="w-4 h-4" />
                    <span className="hidden xl:inline">{t.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Mobile: Dropdown */}
              <div className="lg:hidden mb-4">
                <Select value={tab} onValueChange={handleTabChange}>
                  <SelectTrigger
                    id="account-tab-select"
                    name="account-tab"
                    aria-label="Select account settings tab"
                    className="w-full bg-card border-border"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTabs.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <t.icon className="w-4 h-4" />
                          <span>{t.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Account Settings Tab Content */}
              <Card className="border-border bg-card p-4 sm:p-6">
                <TabsContent value="profile" className="mt-0">
                  <ProfileTab />
                </TabsContent>
                <TabsContent value="preferences" className="mt-0">
                  <PreferencesTab />
                </TabsContent>
                <TabsContent value="privacy" className="mt-0">
                  <PrivacyTab />
                </TabsContent>
                <TabsContent value="data" className="mt-0">
                  <DataTab />
                </TabsContent>
                <TabsContent value="advanced" className="mt-0">
                  <AdvancedTab />
                </TabsContent>
                {isOwner === true && (
                  <TabsContent value="admin" className="mt-0">
                    <AdminTab />
                  </TabsContent>
                )}
              </Card>
            </Tabs>
          </TabsContent>

          {/* Households Section */}
          <TabsContent value="households" className="mt-6 space-y-4">
            {householdsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
              </div>
            ) : households.length === 0 ? (
              <Card className="border-border bg-card p-8">
                <div className="text-center">
                  <Home className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No Households
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Create a household to collaborate on finances with family or roommates
                  </p>
                  <Button
                    onClick={() => setCreateDialogOpen(true)}
                    className="bg-[var(--color-primary)] hover:opacity-90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Household
                  </Button>
                </div>
              </Card>
            ) : (
              <>
                {/* Household Selector - Top Level */}
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select a household to manage its settings
                  </p>
                  
                  {/* Desktop: Horizontal Tabs */}
                  <div className="hidden lg:flex w-full justify-start bg-elevated border border-border overflow-x-auto h-auto flex-wrap gap-1 p-2 rounded-md">
                    {sortedHouseholds.map((household) => (
                      <button
                        key={household.id}
                        onClick={() => handleHouseholdChange(household.id)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-colors relative group",
                          householdId === household.id
                            ? "bg-card text-[var(--color-primary)] shadow-sm"
                            : "text-foreground hover:bg-card/50"
                        )}
                      >
                        <Star
                          className={cn(
                            "w-4 h-4 cursor-pointer transition-colors shrink-0",
                            household.isFavorite
                              ? "fill-[var(--color-warning)] text-[var(--color-warning)]"
                              : "text-muted-foreground hover:text-[var(--color-warning)]"
                          )}
                          onClick={(e) => toggleFavorite(household.id, household.isFavorite, e)}
                        />
                        <Home className="w-4 h-4" />
                        <span>{household.name}</span>
                        {memberCounts[household.id] !== undefined && (
                          <span className="px-1.5 py-0.5 bg-elevated text-xs rounded text-muted-foreground ml-1">
                            {memberCounts[household.id]}
                          </span>
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => setCreateDialogOpen(true)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-colors text-[var(--color-primary)] hover:bg-card/50"
                      )}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create New</span>
                    </button>
                  </div>

                  {/* Mobile: Dropdown */}
                  <div className="lg:hidden mb-4">
                    <Select
                      value={householdId || ''}
                      onValueChange={(value) => {
                        if (value === 'create-new') {
                          setCreateDialogOpen(true);
                        } else {
                          handleHouseholdChange(value);
                        }
                      }}
                    >
                      <SelectTrigger
                        id="household-select"
                        name="household-select"
                        aria-label="Select household"
                        className="w-full bg-card border-border"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedHouseholds.map((household) => (
                          <SelectItem key={household.id} value={household.id}>
                            <div className="flex items-center gap-2 w-full">
                              <Star
                                className={cn(
                                  "w-4 h-4 cursor-pointer transition-colors shrink-0",
                                  household.isFavorite
                                    ? "fill-[var(--color-warning)] text-[var(--color-warning)]"
                                    : "text-muted-foreground"
                                )}
                                onClick={(e) => toggleFavorite(household.id, household.isFavorite, e)}
                              />
                              <Home className="w-4 h-4" />
                              <span>{household.name}</span>
                              {memberCounts[household.id] !== undefined && (
                                <span className="text-muted-foreground text-xs ml-auto">
                                  ({memberCounts[household.id]} members)
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                        <SelectItem value="create-new">
                          <div className="flex items-center gap-2 text-[var(--color-primary)]">
                            <Plus className="w-4 h-4" />
                            <span>Create New Household</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Household Settings Tabs - Second Level */}
                {householdId && (
                  <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
                    {/* Desktop: Horizontal Tabs */}
                    <TabsList className="hidden lg:flex w-full justify-start bg-elevated border border-border h-auto p-2">
                      {HOUSEHOLD_TABS.map((t) => (
                        <TabsTrigger
                          key={t.id}
                          value={t.id}
                          className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:text-[var(--color-primary)] px-4 py-2"
                        >
                          <t.icon className="w-4 h-4" />
                          <span>{t.label}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {/* Mobile: Dropdown */}
                    <div className="lg:hidden mb-4">
                      <Select value={tab} onValueChange={handleTabChange}>
                        <SelectTrigger
                          id="household-settings-tab-select"
                          name="household-settings-tab"
                          aria-label="Select household settings tab"
                          className="w-full bg-card border-border"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOUSEHOLD_TABS.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <div className="flex items-center gap-2">
                                <t.icon className="w-4 h-4" />
                                <span>{t.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Household Settings Tab Content */}
                    <Card className="border-border bg-card p-4 sm:p-6">
                      <TabsContent value="members" className="mt-0">
                        <HouseholdMembersTab householdId={householdId} />
                      </TabsContent>
                      <TabsContent value="household-preferences" className="mt-0">
                        <HouseholdPreferencesTab />
                      </TabsContent>
                      <TabsContent value="household-financial" className="mt-0">
                        <HouseholdFinancialTab />
                      </TabsContent>
                      <TabsContent value="personal" className="mt-0">
                        <HouseholdPersonalTab householdId={householdId} />
                      </TabsContent>
                    </Card>
                  </Tabs>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Household Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Create Household</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Choose a name for your new household
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Label htmlFor="create-household-name" className="text-foreground">
                Household Name
              </Label>
              <Input
                id="create-household-name"
                name="create-household-name"
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="e.g., The Smiths"
                className="mt-1 bg-elevated border-border"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && householdName.trim()) {
                    createHousehold();
                  }
                }}
                autoFocus
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setHouseholdName('');
                }}
                className="border-border"
              >
                Cancel
              </Button>
              <Button
                onClick={createHousehold}
                disabled={!householdName.trim() || submitting}
                className="bg-[var(--color-primary)] hover:opacity-90"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Household
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
      </div>
    }>
      <SettingsPageContent />
    </Suspense>
  );
}
