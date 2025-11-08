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
import { Plus, Users } from 'lucide-react';
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

interface Household {
  id: string;
  name: string;
  createdBy: string;
}

interface HouseholdSelectorProps {
  selectedHouseholdId?: string;
  onHouseholdChange?: (id: string) => void;
}

export function HouseholdSelector({
  selectedHouseholdId,
  onHouseholdChange,
}: HouseholdSelectorProps) {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHouseholds();
  }, []);

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

      if (onHouseholdChange) {
        onHouseholdChange(data.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading households...</div>;
  }

  return (
    <div className="flex items-center gap-2">
      <Users className="w-4 h-4 text-muted-foreground" />
      <Select
        value={selectedHouseholdId || ''}
        onValueChange={(value) => onHouseholdChange?.(value)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select household" />
        </SelectTrigger>
        <SelectContent>
          {households.map((household) => (
            <SelectItem key={household.id} value={household.id}>
              {household.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon">
            <Plus className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Household</DialogTitle>
            <DialogDescription>
              Create a new household to share finances with family members
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Household Name</Label>
              <Input
                id="name"
                placeholder="e.g., Smith Family"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>

            <Button
              onClick={handleCreateHousehold}
              disabled={creating || !newName.trim()}
              className="w-full"
            >
              {creating ? 'Creating...' : 'Create Household'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
