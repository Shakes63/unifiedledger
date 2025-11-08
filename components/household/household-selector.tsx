'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Users, Settings, LogOut } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Household {
  id: string;
  name: string;
  createdBy: string;
  createdAt?: string;
}

interface HouseholdMember {
  id: string;
  userId: string;
  userName?: string;
  userEmail: string;
  role: string;
}

interface HouseholdSelectorProps {
  selectedHouseholdId?: string;
  onHouseholdChange?: (id: string) => void;
}

export function HouseholdSelector({
  selectedHouseholdId: propSelectedHouseholdId,
  onHouseholdChange: propOnHouseholdChange,
}: HouseholdSelectorProps) {
  const router = useRouter();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<HouseholdMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  // Internal state for tracking selected household
  const [internalSelectedId, setInternalSelectedId] = useState<string>('');

  // Use prop if provided, otherwise use internal state
  const selectedHouseholdId = propSelectedHouseholdId || internalSelectedId;

  const handleHouseholdChange = (id: string) => {
    setInternalSelectedId(id);
    propOnHouseholdChange?.(id);
  };

  useEffect(() => {
    const loadHouseholds = async () => {
      await fetchHouseholds();
    };
    loadHouseholds();
  }, []);

  // Auto-select first household when households load
  useEffect(() => {
    if (households.length > 0 && !internalSelectedId && !propSelectedHouseholdId) {
      setInternalSelectedId(households[0].id);
    }
  }, [households.length, internalSelectedId, propSelectedHouseholdId]);

  const fetchHouseholds = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/households');
      if (response.ok) {
        const data = await response.json();
        setHouseholds(data);
      }
    } catch (error) {
      console.error('Failed to fetch households:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (householdId: string) => {
    try {
      setLoadingMembers(true);
      const response = await fetch(`/api/households/${householdId}/members`);
      if (response.ok) {
        const data = await response.json();
        setSelectedMembers(data);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSelectHousehold = async (id: string) => {
    handleHouseholdChange(id);
    await fetchMembers(id);
  };

  const handleLeaveHousehold = async (householdId: string) => {
    if (!confirm('Are you sure you want to leave this household?')) return;

    try {
      const response = await fetch(`/api/households/${householdId}/leave`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('You have left the household');
        // Refresh households list
        await fetchHouseholds();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to leave household');
      }
    } catch (error) {
      toast.error('Failed to leave household');
    }
  };

  const handleCreateHousehold = async () => {
    if (!newName.trim()) {
      setError('Household name is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/households', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create household');
      }

      const data = await response.json();
      setHouseholds([...households, data]);
      setNewName('');
      setDialogOpen(false);

      // Automatically select the newly created household
      handleHouseholdChange(data.id);
      await fetchMembers(data.id);

      toast.success('Household created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-[#6b7280]">Loading households...</div>;
  }

  const selectedHousehold = households.find((h) => h.id === selectedHouseholdId);

  return (
    <div className="flex items-center gap-2">
      <Users className="w-4 h-4 text-[#6b7280]" />
      <Select value={selectedHouseholdId || ''} onValueChange={handleSelectHousehold}>
        <SelectTrigger className="w-[200px] bg-[#242424] border-[#2a2a2a] text-white">
          <SelectValue placeholder="Select household" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
          {households.map((household) => (
            <SelectItem key={household.id} value={household.id}>
              {household.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Household menu */}
      {selectedHousehold && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="border-[#2a2a2a]">
              <Settings className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[#1a1a1a] border-[#2a2a2a]"
          >
            <DropdownMenuItem
              onClick={() => router.push(`/dashboard/households/${selectedHousehold.id}`)}
              className="text-white cursor-pointer"
            >
              <Users className="w-4 h-4 mr-2" />
              Manage Household
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#2a2a2a]" />
            <DropdownMenuItem
              onClick={() => handleLeaveHousehold(selectedHousehold.id)}
              className="text-[#f87171] cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Leave Household
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Create household button */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" className="border-[#2a2a2a]">
            <Plus className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a]">
          <DialogHeader>
            <DialogTitle className="text-white">Create Household</DialogTitle>
            <DialogDescription className="text-[#9ca3af]">
              Create a new household to share finances with family members
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-[#f87171]/10 border border-[#f87171]/30 rounded-lg text-[#f87171] text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">
                Household Name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Smith Family"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-[#242424] border-[#2a2a2a] text-white"
                autoFocus
              />
            </div>

            <Button
              onClick={handleCreateHousehold}
              disabled={creating || !newName.trim()}
              className="w-full bg-[#10b981] hover:bg-[#059669] text-white"
            >
              {creating ? 'Creating...' : 'Create Household'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
