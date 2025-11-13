'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { ProfileTab } from '@/components/settings/profile-tab';
import { PreferencesTab } from '@/components/settings/preferences-tab';
import { FinancialTab } from '@/components/settings/financial-tab';
import { NotificationsTab } from '@/components/settings/notifications-tab';
import { ThemeTab } from '@/components/settings/theme-tab';
import { HouseholdTab } from '@/components/settings/household-tab';
import { PrivacyTab } from '@/components/settings/privacy-tab';
import { DataTab } from '@/components/settings/data-tab';
import { AdvancedTab } from '@/components/settings/advanced-tab';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'preferences', label: 'Preferences', icon: Settings },
  { id: 'financial', label: 'Financial', icon: DollarSign },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'household', label: 'Household', icon: Users },
  { id: 'privacy', label: 'Privacy & Security', icon: Lock },
  { id: 'data', label: 'Data Management', icon: Database },
  { id: 'advanced', label: 'Advanced', icon: Code },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') || 'profile';

  const handleTabChange = (tab: string) => {
    router.push(`/dashboard/settings?tab=${tab}`);
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account, preferences, and application settings
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          {/* Desktop: Horizontal Tabs */}
          <TabsList className="hidden lg:flex w-full justify-start bg-elevated border border-border overflow-x-auto h-auto flex-wrap gap-1 p-2">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:text-[var(--color-primary)] px-3 py-2"
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden xl:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Mobile: Dropdown */}
          <div className="lg:hidden mb-4">
            <Select value={activeTab} onValueChange={handleTabChange}>
              <SelectTrigger
                id="settings-tab-select"
                name="settings-tab"
                aria-label="Select settings tab"
                className="w-full bg-card border-border"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABS.map((tab) => (
                  <SelectItem key={tab.id} value={tab.id}>
                    <div className="flex items-center gap-2">
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tab Content */}
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
            <TabsContent value="notifications" className="mt-0">
              <NotificationsTab />
            </TabsContent>
            <TabsContent value="theme" className="mt-0">
              <ThemeTab />
            </TabsContent>
            <TabsContent value="household" className="mt-0">
              <HouseholdTab />
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
          </Card>
        </Tabs>
      </div>
    </div>
  );
}
