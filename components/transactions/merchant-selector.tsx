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
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

interface Merchant {
  id: string;
  name: string;
  usageCount: number;
}

interface MerchantSelectorProps {
  selectedMerchant: string | null;
  onMerchantChange: (merchantId: string | null) => void;
  hideLabel?: boolean;
}

export function MerchantSelector({
  selectedMerchant,
  onMerchantChange,
  hideLabel = false,
}: MerchantSelectorProps) {
  const { fetchWithHousehold, postWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [_loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newMerchantName, setNewMerchantName] = useState('');
  const [creatingMerchant, setCreatingMerchant] = useState(false);

  useEffect(() => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    const fetchMerchants = async () => {
      try {
        setLoading(true);
        const response = await fetchWithHousehold('/api/merchants');
        if (response.ok) {
          const data = await response.json();
          setMerchants(data);
        }
      } catch (error) {
        console.error('Failed to fetch merchants:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMerchants();
  }, [selectedHouseholdId, fetchWithHousehold]);

  const handleCreateMerchant = async () => {
    if (!newMerchantName.trim()) {
      toast.error('Merchant name is required');
      return;
    }

    setCreatingMerchant(true);
    try {
      const response = await postWithHousehold('/api/merchants', {
        name: newMerchantName,
      });

      if (response.ok) {
        const newMerchant = await response.json();
        // Add to merchants list
        setMerchants([...merchants, newMerchant]);
        // Auto-select the new merchant
        onMerchantChange(newMerchant.id);
        // Reset creation UI
        setNewMerchantName('');
        setIsCreating(false);
        toast.success(`Merchant "${newMerchant.name}" created!`);
      } else {
        toast.error('Failed to create merchant');
      }
    } catch (error) {
      console.error('Error creating merchant:', error);
      toast.error('Error creating merchant');
    } finally {
      setCreatingMerchant(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateMerchant();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
      setNewMerchantName('');
    }
  };

  return (
    <div className="space-y-2">
      {!hideLabel && <label className="text-sm font-medium text-foreground">Merchant</label>}
      {!isCreating ? (
        <div className="flex gap-2">
          <Select value={selectedMerchant || ''} onValueChange={onMerchantChange}>
            <SelectTrigger className="flex-1 bg-elevated border border-border text-foreground rounded-lg">
              <SelectValue placeholder="Select or skip" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Skip (No merchant)</SelectItem>
              {merchants.map((merchant) => (
                <SelectItem key={merchant.id} value={merchant.id}>
                  {merchant.name} ({merchant.usageCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsCreating(true)}
            className="bg-elevated border-border text-muted-foreground hover:bg-border hover:text-foreground"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            autoFocus
            type="text"
            placeholder="New merchant name..."
            value={newMerchantName}
            onChange={(e) => setNewMerchantName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-elevated border border-[var(--color-primary)] text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <Button
            type="button"
            size="icon"
            onClick={handleCreateMerchant}
            disabled={creatingMerchant || !newMerchantName.trim()}
            className="bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-foreground)]"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              setIsCreating(false);
              setNewMerchantName('');
            }}
            className="bg-elevated border-border text-muted-foreground hover:bg-border hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
