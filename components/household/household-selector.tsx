'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Users, Settings, ChevronDown, Loader2, Building2 } from 'lucide-react';
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
  const {
    households,
    selectedHouseholdId,
    loading,
    preferencesLoading,
    entities = [],
    selectedEntityId,
    entitiesLoading = false,
    setSelectedHouseholdId,
    setSelectedEntityId,
  } = useHousehold();
  const [isSwitching, setIsSwitching] = useState(false);
  const [isSwitchingEntity, setIsSwitchingEntity] = useState(false);

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
    return <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Loading households...</div>;
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
  const isEntityLoading = isSwitchingEntity || entitiesLoading;
  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId);

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <Users className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex-1 min-w-0 justify-between border"
              style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="truncate">Switching...</span>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin shrink-0" />
                </>
              ) : (
                <>
                  <span className="truncate">
                    {selectedHousehold?.name || 'Select household'}
                  </span>
                  <ChevronDown className="w-4 h-4 ml-2 opacity-50 shrink-0" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-56 border"
            style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
          >
            {sortedHouseholds.map((household) => (
              <DropdownMenuItem
                key={household.id}
                onClick={() => handleHouseholdSwitch(household.id)}
                disabled={isLoading}
                className="cursor-pointer"
                style={{ color: 'var(--color-foreground)', ...(household.id === selectedHouseholdId ? { backgroundColor: 'var(--color-elevated)' } : {}) }}
              >
                {household.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator style={{ backgroundColor: 'var(--color-border)' }} />
            <DropdownMenuItem
              onClick={() => router.push(manageHouseholdsUrl)}
              disabled={isLoading}
              className="cursor-pointer"
              style={{ color: 'var(--color-foreground)' }}
            >
              <Settings className="w-4 h-4 mr-2" />
              Manage Households
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {entities.length > 1 && (
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex-1 min-w-0 justify-between border"
                style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
                disabled={isEntityLoading}
              >
                {isEntityLoading ? (
                  <>
                    <span className="truncate">Switching Entity...</span>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin shrink-0" />
                  </>
                ) : (
                  <>
                    <span className="truncate">{selectedEntity?.name || 'Select entity'}</span>
                    <ChevronDown className="w-4 h-4 ml-2 opacity-50 shrink-0" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
              {entities.map((entity) => (
                <DropdownMenuItem
                  key={entity.id}
                  onClick={async () => {
                    if (entity.id === selectedEntityId || isEntityLoading) return;
                    setIsSwitchingEntity(true);
                    try {
                      await setSelectedEntityId(entity.id);
                    } catch (error) {
                      console.error('Failed to switch entity:', error);
                    } finally {
                      setIsSwitchingEntity(false);
                    }
                  }}
                  disabled={isEntityLoading}
                  className="cursor-pointer"
                  style={{ color: 'var(--color-foreground)', ...(entity.id === selectedEntityId ? { backgroundColor: 'var(--color-elevated)' } : {}) }}
                >
                  {entity.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
