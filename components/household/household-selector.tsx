'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Users, Settings, ChevronDown, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { useHousehold } from '@/contexts/household-context';

export function HouseholdSelector() {
  const router = useRouter();
  const { households, selectedHouseholdId, loading, preferencesLoading, setSelectedHouseholdId } = useHousehold();
  const [isSwitching, setIsSwitching] = useState(false);

  // Handle household switching with loading state
  const handleHouseholdSwitch = async (householdId: string) => {
    if (householdId === selectedHouseholdId || isSwitching) return;

    setIsSwitching(true);
    try {
      await setSelectedHouseholdId(householdId);
    } catch (error) {
      console.error('Failed to switch household:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading households...</div>;
  }

  const selectedHousehold = households.find((h) => h.id === selectedHouseholdId);
  const manageHouseholdsId = selectedHouseholdId ?? households[0]?.id ?? null;
  const manageHouseholdsUrl = manageHouseholdsId
    ? `/dashboard/settings?section=households&household=${manageHouseholdsId}&tab=members`
    : `/dashboard/settings?section=households&tab=members`;

  // Sort households: favorites first, then by join date (oldest first)
  const sortedHouseholds = [...households].sort((a, b) => {
    // Favorites come first
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    // Within same favorite status, sort by join date
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
  });

  const isLoading = isSwitching || preferencesLoading;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex-1 min-w-0 justify-between bg-elevated border-border text-foreground hover:bg-elevated hover:text-foreground"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="truncate">Switching...</span>
                <Loader2 className="w-4 h-4 ml-2 animate-spin flex-shrink-0" />
              </>
            ) : (
              <>
                <span className="truncate">
                  {selectedHousehold?.name || 'Select household'}
                </span>
                <ChevronDown className="w-4 h-4 ml-2 opacity-50 flex-shrink-0" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="bg-card border-border w-56"
        >
          {sortedHouseholds.map((household) => (
            <DropdownMenuItem
              key={household.id}
              onClick={() => handleHouseholdSwitch(household.id)}
              disabled={isLoading}
              className={`text-foreground cursor-pointer ${
                household.id === selectedHouseholdId ? 'bg-elevated' : ''
              }`}
            >
              {household.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            onClick={() => router.push(manageHouseholdsUrl)}
            disabled={isLoading}
            className="text-foreground cursor-pointer"
          >
            <Settings className="w-4 h-4 mr-2" />
            Manage Households
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
