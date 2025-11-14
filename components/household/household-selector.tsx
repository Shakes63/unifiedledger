'use client';

import { Button } from '@/components/ui/button';
import { Users, Settings, ChevronDown } from 'lucide-react';
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
  const { households, selectedHouseholdId, loading, setSelectedHouseholdId } = useHousehold();

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading households...</div>;
  }

  const selectedHousehold = households.find((h) => h.id === selectedHouseholdId);

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex-1 min-w-0 justify-between bg-elevated border-border text-foreground hover:bg-elevated hover:text-foreground"
          >
            <span className="truncate">
              {selectedHousehold?.name || 'Select household'}
            </span>
            <ChevronDown className="w-4 h-4 ml-2 opacity-50 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="bg-card border-border w-56"
        >
          {households.map((household) => (
            <DropdownMenuItem
              key={household.id}
              onClick={() => setSelectedHouseholdId(household.id)}
              className={`text-foreground cursor-pointer ${
                household.id === selectedHouseholdId ? 'bg-elevated' : ''
              }`}
            >
              {household.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            onClick={() => router.push('/dashboard/settings?tab=household')}
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
