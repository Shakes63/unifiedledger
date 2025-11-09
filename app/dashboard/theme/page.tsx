'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Palette, Check, Lock } from 'lucide-react';
import { type Theme } from '@/lib/themes/theme-config';
import { getAllThemes, getTheme, applyTheme } from '@/lib/themes/theme-utils';
import { toast } from 'sonner';

export default function ThemePage() {
  const [currentThemeId, setCurrentThemeId] = useState<string>('dark-mode');
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('dark-mode');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const allThemes = getAllThemes();

  // Fetch current theme on mount
  useEffect(() => {
    const fetchTheme = async () => {
      try {
        const response = await fetch('/api/user/settings/theme');
        if (response.ok) {
          const data = await response.json();
          setCurrentThemeId(data.theme);
          setSelectedThemeId(data.theme);
          const theme = getTheme(data.theme);
          setCurrentTheme(theme);
          // Apply the theme immediately on load
          applyTheme(data.theme);
        }
      } catch (error) {
        console.error('Failed to fetch theme:', error);
        toast.error('Failed to load theme settings');
      } finally {
        setLoading(false);
      }
    };

    fetchTheme();
  }, []);

  // Update current theme when ID changes
  useEffect(() => {
    const theme = getTheme(currentThemeId);
    setCurrentTheme(theme);
  }, [currentThemeId]);

  const handleThemeSelect = (themeId: string) => {
    const theme = getTheme(themeId);
    if (!theme || !theme.isAvailable) {
      toast.error('This theme is not available yet');
      return;
    }
    setSelectedThemeId(themeId);
  };

  const handleSaveTheme = async () => {
    if (selectedThemeId === currentThemeId) {
      toast.info('This theme is already active');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/user/settings/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: selectedThemeId }),
      });

      if (response.ok) {
        setCurrentThemeId(selectedThemeId);
        toast.success('Theme updated successfully!');
        // Apply immediately after successful save
        applyTheme(selectedThemeId);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update theme');
      }
    } catch (error) {
      console.error('Failed to save theme:', error);
      toast.error('Failed to save theme');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !currentTheme) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm text-gray-400">Loading theme settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Palette className="w-6 h-6 text-accent" />
            <h1 className="text-2xl font-bold text-foreground">Theme Settings</h1>
          </div>
          <p className="text-sm text-gray-400">
            Customize the appearance of your finance dashboard
          </p>
        </div>

        {/* Current Theme Section */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Current Theme
          </h2>
          <Card className="p-6 border border-border bg-card rounded-xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-foreground">{currentTheme.name}</h3>
                  <span className="px-2 py-1 bg-accent/20 text-accent text-xs rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Active
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{currentTheme.description}</p>
              </div>
            </div>

            {/* Color Palette Preview */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Color Palette
              </h4>

              {/* Background Colors */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Backgrounds</p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-2">
                    <div
                      className="h-16 rounded-lg border border-border"
                      style={{ backgroundColor: currentTheme.colors.background, color: 'transparent' }}
                    />
                    <div className="text-xs">
                      <p className="text-muted-foreground font-medium">Background</p>
                      <p className="text-muted-foreground font-mono text-[10px] break-all">{currentTheme.colors.background}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div
                      className="h-16 rounded-lg border border-border"
                      style={{ backgroundColor: currentTheme.colors.surface, color: 'transparent' }}
                    />
                    <div className="text-xs">
                      <p className="text-muted-foreground font-medium">Surface</p>
                      <p className="text-muted-foreground font-mono text-[10px] break-all">{currentTheme.colors.surface}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div
                      className="h-16 rounded-lg border border-border"
                      style={{ backgroundColor: currentTheme.colors.elevated, color: 'transparent' }}
                    />
                    <div className="text-xs">
                      <p className="text-muted-foreground font-medium">Elevated</p>
                      <p className="text-muted-foreground font-mono text-[10px] break-all">{currentTheme.colors.elevated}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div
                      className="h-16 rounded-lg border"
                      style={{
                        backgroundColor: currentTheme.colors.background,
                        borderColor: currentTheme.colors.border,
                        color: 'transparent'
                      }}
                    />
                    <div className="text-xs">
                      <p className="text-muted-foreground font-medium">Border</p>
                      <p className="text-muted-foreground font-mono text-[10px] break-all">{currentTheme.colors.border}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction Colors */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Transactions</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <div
                      className="h-16 rounded-lg"
                      style={{ backgroundColor: currentTheme.colors.income, color: 'transparent' }}
                    />
                    <div className="text-xs">
                      <p className="text-muted-foreground font-medium">Income</p>
                      <p className="text-muted-foreground font-mono text-[10px] break-all">{currentTheme.colors.income}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div
                      className="h-16 rounded-lg"
                      style={{ backgroundColor: currentTheme.colors.expense, color: 'transparent' }}
                    />
                    <div className="text-xs">
                      <p className="text-muted-foreground font-medium">Expense</p>
                      <p className="text-muted-foreground font-mono text-[10px] break-all">{currentTheme.colors.expense}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div
                      className="h-16 rounded-lg"
                      style={{ backgroundColor: currentTheme.colors.transfer, color: 'transparent' }}
                    />
                    <div className="text-xs">
                      <p className="text-muted-foreground font-medium">Transfer</p>
                      <p className="text-muted-foreground font-mono text-[10px] break-all">{currentTheme.colors.transfer}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* UI Colors */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">UI Elements</p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-2">
                    <div
                      className="h-16 rounded-lg"
                      style={{ backgroundColor: currentTheme.colors.success, color: 'transparent' }}
                    />
                    <div className="text-xs">
                      <p className="text-muted-foreground font-medium">Success</p>
                      <p className="text-muted-foreground font-mono text-[10px] break-all">{currentTheme.colors.success}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div
                      className="h-16 rounded-lg"
                      style={{ backgroundColor: currentTheme.colors.warning, color: 'transparent' }}
                    />
                    <div className="text-xs">
                      <p className="text-muted-foreground font-medium">Warning</p>
                      <p className="text-muted-foreground font-mono text-[10px] break-all">{currentTheme.colors.warning}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div
                      className="h-16 rounded-lg"
                      style={{ backgroundColor: currentTheme.colors.error, color: 'transparent' }}
                    />
                    <div className="text-xs">
                      <p className="text-muted-foreground font-medium">Error</p>
                      <p className="text-muted-foreground font-mono text-[10px] break-all">{currentTheme.colors.error}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div
                      className="h-16 rounded-lg"
                      style={{ backgroundColor: currentTheme.colors.primary, color: 'transparent' }}
                    />
                    <div className="text-xs">
                      <p className="text-muted-foreground font-medium">Primary</p>
                      <p className="text-muted-foreground font-mono text-[10px] break-all">{currentTheme.colors.primary}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Theme Selector Section */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Available Themes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {allThemes.map((theme) => {
              const isSelected = selectedThemeId === theme.id;
              const isCurrent = currentThemeId === theme.id;
              const isAvailable = theme.isAvailable;

              return (
                <Card
                  key={theme.id}
                  className={`p-6 border rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-card hover:bg-elevated'
                  } ${!isAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={() => isAvailable && handleThemeSelect(theme.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-foreground">{theme.name}</h3>
                        {isCurrent && (
                          <span className="px-2 py-1 bg-accent/20 text-accent text-xs rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Active
                          </span>
                        )}
                        {!isAvailable && (
                          <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{theme.description}</p>
                    </div>
                    {isSelected && isAvailable && (
                      <div className="p-2 bg-accent/20 rounded-lg shrink-0 ml-3">
                        <Check className="w-5 h-5 text-accent" />
                      </div>
                    )}
                  </div>

                  {/* Color Preview */}
                  <div className="flex items-center gap-2">
                    <div className="relative group">
                      <div
                        className="w-8 h-8 rounded-full border border-border cursor-help"
                        style={{ backgroundColor: theme.colors.income, color: 'transparent' }}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-elevated border border-border rounded text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                        Income
                      </div>
                    </div>
                    <div className="relative group">
                      <div
                        className="w-8 h-8 rounded-full border border-border cursor-help"
                        style={{ backgroundColor: theme.colors.expense, color: 'transparent' }}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-elevated border border-border rounded text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                        Expense
                      </div>
                    </div>
                    <div className="relative group">
                      <div
                        className="w-8 h-8 rounded-full border border-border cursor-help"
                        style={{ backgroundColor: theme.colors.transfer, color: 'transparent' }}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-elevated border border-border rounded text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                        Transfer
                      </div>
                    </div>
                    <div className="relative group">
                      <div
                        className="w-8 h-8 rounded-full border border-border cursor-help"
                        style={{ backgroundColor: theme.colors.primary, color: 'transparent' }}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-elevated border border-border rounded text-xs text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                        Primary
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Save Button */}
          {selectedThemeId !== currentThemeId && (
            <div className="flex justify-end">
              <Button
                onClick={handleSaveTheme}
                disabled={saving}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {saving ? 'Saving...' : 'Apply Theme'}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
