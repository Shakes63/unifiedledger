# Experimental Features Implementation Plan

## Overview
Make the experimental features flag in Advanced Settings functional by creating a system that allows features to be gated behind the experimental flag. This enables gradual rollout of new features and allows users to opt-in to beta functionality.

## Current State
- Experimental features toggle exists in Advanced tab (`components/settings/advanced-tab.tsx`)
- Setting is saved to `userSettings.experimentalFeatures` in database
- Toggle state is tracked but doesn't control any features
- No features are currently gated behind this flag

## Goals
1. Create a reusable system for gating features behind experimental flag
2. Implement at least 3-5 experimental features to demonstrate the system
3. Provide clear UI indicators when experimental features are active
4. Make it easy for developers to add new experimental features

## Proposed Experimental Features

### 1. Enhanced Transaction Search (Low Risk)
- **What:** Advanced search with regex support and saved search filters
- **Why:** Users already have search, this extends it with power user features
- **Location:** Transactions page search bar
- **Risk:** Low - doesn't modify data, just changes search behavior

### 2. Bulk Transaction Operations (Medium Risk)
- **What:** Select multiple transactions and perform batch operations (category change, delete, etc.)
- **Why:** Saves time for users with many transactions
- **Location:** Transactions page with checkboxes
- **Risk:** Medium - modifies multiple records, needs careful validation

### 3. AI-Powered Category Suggestions (Medium Risk)
- **What:** Use transaction description patterns to suggest better categories
- **Why:** Helps users categorize transactions more accurately
- **Location:** Transaction edit dialog
- **Risk:** Medium - suggestions could be wrong, but user confirms

### 4. Advanced Chart Types (Low Risk)
- **What:** Additional chart types in Reports: Heatmap, Treemap, Sankey diagram
- **Why:** More visualization options for financial data
- **Location:** Reports page
- **Risk:** Low - visual only, doesn't modify data

### 5. Quick Entry Mode (Low Risk)
- **What:** Keyboard-focused rapid transaction entry (press 'Q' to open, tab through fields)
- **Why:** Power users can enter transactions faster
- **Location:** Global keyboard shortcut
- **Risk:** Low - just a faster UI for existing functionality

## Implementation Strategy

### Phase 1: Infrastructure (45 minutes)
Create the core system for managing experimental features

**1.1. Create Experimental Features Context** (20 min)
- File: `lib/contexts/experimental-features-context.tsx`
- Provides: `useExperimentalFeatures()` hook
- Exports: `ExperimentalFeaturesProvider`, `useExperimentalFeatures`
- Features:
  - Loads `experimentalFeatures` from user settings
  - Provides helper functions: `isEnabled()`, `getEnabledFeatures()`
  - Caches setting value in memory for performance

**1.2. Create Feature Flag Helper** (15 min)
- File: `lib/experimental-features.ts`
- Constants: `EXPERIMENTAL_FEATURES` object with feature definitions
- Each feature has: `id`, `name`, `description`, `category`, `riskLevel`
- Helper functions: `isFeatureEnabled()`, `getFeatureInfo()`

**1.3. Create Feature Gate Component** (10 min)
- File: `components/experimental/feature-gate.tsx`
- Props: `featureId: string`, `fallback?: ReactNode`, `children: ReactNode`
- Usage: `<FeatureGate featureId="bulk-operations">...</FeatureGate>`
- Only renders children if experimental features enabled

### Phase 2: UI Indicators (30 minutes)

**2.1. Experimental Badge Component** (15 min)
- File: `components/experimental/experimental-badge.tsx`
- Small badge with "EXPERIMENTAL" text and beaker icon
- Tooltip explaining the feature is experimental
- Uses semantic theme colors

**2.2. Update Advanced Tab** (15 min)
- Add list of available experimental features below the toggle
- Show which features will be unlocked when enabled
- Include risk level indicators (Low/Medium/High)

### Phase 3: Implement Features (2-3 hours)

**3.1. Quick Entry Mode** (45 min)
- Create `components/transactions/quick-entry-modal.tsx`
- Global keyboard listener (Q key when not in input)
- Streamlined form with tab navigation
- Auto-focus on amount field
- ESC to close
- Only visible when experimental features enabled

**3.2. Enhanced Transaction Search** (30 min)
- Add regex toggle to existing search
- Add "Save this search" button (creates filter in saved searches)
- Only show these options when experimental features enabled

**3.3. Advanced Chart Types** (45 min)
- Add 2-3 new chart types to Reports page
- Heatmap for spending by category over time
- Treemap for category breakdown
- Wrap in `<FeatureGate featureId="advanced-charts">`

### Phase 4: Testing (30 minutes)

**4.1. Manual Testing Checklist**
- [ ] Toggle experimental features ON in Advanced settings
- [ ] Verify each experimental feature appears
- [ ] Verify experimental badges are visible
- [ ] Toggle experimental features OFF
- [ ] Verify experimental features are hidden
- [ ] Test that features work correctly when enabled
- [ ] Verify no console errors

**4.2. Edge Cases**
- [ ] Features hidden for users who haven't enabled experimental flag
- [ ] Toggling flag requires page refresh (or live update?)
- [ ] Settings persist across sessions

### Phase 5: Documentation (20 minutes)

**5.1. Update Documentation**
- Add experimental features section to features.md
- Document how to add new experimental features
- Add comments in code explaining the system

**5.2. User-Facing Documentation**
- Add help text in Advanced tab explaining what experimental means
- List each experimental feature with description and risk level

## Technical Implementation Details

### Experimental Features Context

```typescript
// lib/contexts/experimental-features-context.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ExperimentalFeaturesContextType {
  enabled: boolean;
  loading: boolean;
}

const ExperimentalFeaturesContext = createContext<ExperimentalFeaturesContextType>({
  enabled: false,
  loading: true,
});

export function ExperimentalFeaturesProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch('/api/user/settings');
        if (response.ok) {
          const data = await response.json();
          setEnabled(data.experimentalFeatures || false);
        }
      } catch (error) {
        console.error('Failed to load experimental features setting:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  return (
    <ExperimentalFeaturesContext.Provider value={{ enabled, loading }}>
      {children}
    </ExperimentalFeaturesContext.Provider>
  );
}

export function useExperimentalFeatures() {
  return useContext(ExperimentalFeaturesContext);
}
```

### Feature Definitions

```typescript
// lib/experimental-features.ts

export type FeatureRiskLevel = 'low' | 'medium' | 'high';

export interface ExperimentalFeature {
  id: string;
  name: string;
  description: string;
  category: 'ui' | 'data' | 'performance' | 'analytics';
  riskLevel: FeatureRiskLevel;
}

export const EXPERIMENTAL_FEATURES: Record<string, ExperimentalFeature> = {
  'quick-entry': {
    id: 'quick-entry',
    name: 'Quick Entry Mode',
    description: 'Keyboard-focused rapid transaction entry (press Q)',
    category: 'ui',
    riskLevel: 'low',
  },
  'enhanced-search': {
    id: 'enhanced-search',
    name: 'Enhanced Transaction Search',
    description: 'Advanced search with regex support and saved filters',
    category: 'ui',
    riskLevel: 'low',
  },
  'advanced-charts': {
    id: 'advanced-charts',
    name: 'Advanced Chart Types',
    description: 'Additional visualization options (heatmap, treemap)',
    category: 'analytics',
    riskLevel: 'low',
  },
};

export function getExperimentalFeatures(): ExperimentalFeature[] {
  return Object.values(EXPERIMENTAL_FEATURES);
}
```

### Feature Gate Component

```typescript
// components/experimental/feature-gate.tsx
'use client';

import { useExperimentalFeatures } from '@/lib/contexts/experimental-features-context';
import { ReactNode } from 'react';

interface FeatureGateProps {
  featureId: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function FeatureGate({ featureId, fallback = null, children }: FeatureGateProps) {
  const { enabled, loading } = useExperimentalFeatures();

  if (loading) return null;
  if (!enabled) return <>{fallback}</>;

  return <>{children}</>;
}
```

### Experimental Badge Component

```typescript
// components/experimental/experimental-badge.tsx
import { Badge } from '@/components/ui/badge';
import { Beaker } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ExperimentalBadge() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="ml-2 border-[var(--color-warning)] text-[var(--color-warning)] bg-[var(--color-warning)]/10"
          >
            <Beaker className="w-3 h-3 mr-1" />
            EXPERIMENTAL
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="bg-card border-border">
          <p className="text-xs text-muted-foreground">
            This feature is experimental and may change or be removed in future updates
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

## User Experience

### Enabling Experimental Features:
1. User navigates to **Settings → Advanced**
2. Sees "Experimental Features" toggle with warning icon
3. Below toggle, sees list of features that will be unlocked
4. Each feature shows: name, description, risk level badge
5. User enables toggle
6. Success toast: "Experimental features enabled. Some features may require refresh."
7. Experimental features now appear throughout app with badges

### Using Experimental Features:
- Quick Entry: Press 'Q' anywhere to open quick entry dialog
- Enhanced Search: Regex toggle appears in transaction search
- Advanced Charts: New chart options in Reports page
- All experimental features show "EXPERIMENTAL" badge

### Disabling Experimental Features:
1. User toggles off in Advanced settings
2. All experimental features immediately hidden
3. No data is lost, just UI features hidden

## Benefits

1. **Safe Feature Rollout:** Test new features with willing users before general release
2. **User Control:** Power users can access advanced features, casual users aren't overwhelmed
3. **Developer Friendly:** Easy to add new experimental features with simple gate component
4. **Clear Communication:** Badges make it obvious which features are experimental
5. **No Breaking Changes:** Disabling experimental features doesn't break existing functionality

## Edge Cases & Handling

1. **User enables feature mid-session:** Require page refresh or implement live updates
2. **Experimental feature breaks:** Users can disable flag to revert to stable features
3. **Feature graduates to stable:** Remove from experimental list, remove gates
4. **Multiple users in household:** Setting is per-user, not per-household
5. **API compatibility:** Experimental features that need new APIs should gracefully degrade

## Success Criteria

1. ✅ Experimental features toggle controls feature visibility
2. ✅ At least 3 experimental features implemented
3. ✅ Clear UI indicators (badges) on experimental features
4. ✅ Easy for developers to add new experimental features
5. ✅ No errors when toggling experimental features on/off
6. ✅ Documentation updated with experimental features system

## Timeline

- **Phase 1 (Infrastructure):** 45 minutes
- **Phase 2 (UI Indicators):** 30 minutes
- **Phase 3 (Implement Features):** 2-3 hours
- **Phase 4 (Testing):** 30 minutes
- **Phase 5 (Documentation):** 20 minutes

**Total Estimated Time:** 4-5 hours

## Future Enhancements

- Per-feature toggle (enable/disable individual experimental features)
- Feedback mechanism for experimental features
- Analytics on experimental feature usage
- A/B testing framework using experimental flags
- Admin panel to control which features are experimental
