'use client';

import { useState } from 'react';
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
import {
  User,
  Settings,
  DollarSign,
  Bell,
  Palette,
  Users,
  Lock,
  Database,
  Code,
  Home,
} from 'lucide-react';

// Import existing tab components
import { ProfileTab } from '@/components/settings/profile-tab';
import { PreferencesTab } from '@/components/settings/preferences-tab';
import { FinancialTab } from '@/components/settings/financial-tab';
import { NotificationsTab } from '@/components/settings/notifications-tab';
import { ThemeTab } from '@/components/settings/theme-tab';
import { HouseholdTab } from '@/components/settings/household-tab';
import { PrivacyTab } from '@/components/settings/privacy-tab';
import { DataTab } from '@/components/settings/data-tab';
import { AdvancedTab } from '@/components/settings/advanced-tab';

// User Settings tabs (user-only + user-per-household)
const USER_SETTINGS_TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'preferences', label: 'Preferences', icon: Settings },
  { id: 'financial', label: 'Financial', icon: DollarSign },
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy & Security', icon: Lock },
  { id: 'advanced', label: 'Advanced', icon: Code },
];

// Household Settings tabs (household-only)
const HOUSEHOLD_SETTINGS_TABS = [
  { id: 'household-preferences', label: 'Preferences', icon: Settings },
  { id: 'household-financial', label: 'Financial', icon: DollarSign },
  { id: 'household-data', label: 'Data Management', icon: Database },
  { id: 'household-members', label: 'Members', icon: Users },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { selectedHousehold } = useHousehold();

  // Get top-level section (user or household)
  const section = searchParams.get('section') || 'user';
  const tab = searchParams.get('tab') || (section === 'user' ? 'profile' : 'household-preferences');

  const handleSectionChange = (newSection: string) => {
    const defaultTab = newSection === 'user' ? 'profile' : 'household-preferences';
    router.push(`/dashboard/settings?section=${newSection}&tab=${defaultTab}`);
  };

  const handleTabChange = (newTab: string) => {
    router.push(`/dashboard/settings?section=${section}&tab=${newTab}`);
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your personal settings and household configuration
          </p>
        </div>

        {/* Top-Level Tabs: User Settings vs Household Settings */}
        <Tabs value={section} onValueChange={handleSectionChange} className="w-full">
          {/* Top-Level Tab List */}
          <TabsList className="grid w-full grid-cols-2 bg-elevated border border-border h-12">
            <TabsTrigger
              value="user"
              className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:text-[var(--color-primary)]"
            >
              <User className="w-4 h-4" />
              <span>User Settings</span>
            </TabsTrigger>
            <TabsTrigger
              value="household"
              className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:text-[var(--color-primary)]"
            >
              <Home className="w-4 h-4" />
              <span>Household Settings</span>
              {selectedHousehold && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  ({selectedHousehold.name})
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* User Settings Section */}
          <TabsContent value="user" className="mt-6 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Personal settings and preferences for the current household
              </p>
            </div>

            <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
              {/* Desktop: Horizontal Tabs */}
              <TabsList className="hidden lg:flex w-full justify-start bg-elevated border border-border overflow-x-auto h-auto flex-wrap gap-1 p-2">
                {USER_SETTINGS_TABS.map((t) => (
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
                    id="user-settings-tab-select"
                    name="user-settings-tab"
                    aria-label="Select user settings tab"
                    className="w-full bg-card border-border"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_SETTINGS_TABS.map((t) => (
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

              {/* User Settings Tab Content */}
              <Card className="border-border bg-card p-4 sm:p-6">
                <TabsContent value="profile" className="mt-0">
                  <ProfileTab />
                </TabsContent>
                <TabsContent value="preferences" className="mt-0">
                  <PreferencesTab />
                </TabsContent>
                <TabsContent value="financial" className="mt-0">
                  <FinancialTab />
                </TabsContent>
                <TabsContent value="theme" className="mt-0">
                  <ThemeTab />
                </TabsContent>
                <TabsContent value="notifications" className="mt-0">
                  <NotificationsTab />
                </TabsContent>
                <TabsContent value="privacy" className="mt-0">
                  <PrivacyTab />
                </TabsContent>
                <TabsContent value="advanced" className="mt-0">
                  <AdvancedTab />
                </TabsContent>
              </Card>
            </Tabs>
          </TabsContent>

          {/* Household Settings Section */}
          <TabsContent value="household" className="mt-6 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Settings shared by all members of{' '}
                <span className="font-medium text-foreground">
                  {selectedHousehold?.name || 'this household'}
                </span>
              </p>
            </div>

            <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
              {/* Desktop: Horizontal Tabs */}
              <TabsList className="hidden lg:flex w-full justify-start bg-elevated border border-border h-auto p-2">
                {HOUSEHOLD_SETTINGS_TABS.map((t) => (
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
                    {HOUSEHOLD_SETTINGS_TABS.map((t) => (
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
                <TabsContent value="household-preferences" className="mt-0">
                  <PreferencesTab />
                </TabsContent>
                <TabsContent value="household-financial" className="mt-0">
                  <FinancialTab />
                </TabsContent>
                <TabsContent value="household-data" className="mt-0">
                  <DataTab />
                </TabsContent>
                <TabsContent value="household-members" className="mt-0">
                  <HouseholdTab />
                </TabsContent>
              </Card>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
