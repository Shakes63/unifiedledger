'use client';

import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

interface Merchant {
  id: string;
  name: string;
  usageCount: number;
  isSalesTaxExempt?: boolean;
}

interface MerchantSelectorProps {
  selectedMerchant: string | null;
  onMerchantChange: (merchantId: string | null) => void;
  onMerchantExemptChange?: (isExempt: boolean) => void;
  hideLabel?: boolean;
}

export function MerchantSelector({
  selectedMerchant,
  onMerchantChange,
  onMerchantExemptChange,
  hideLabel = false,
}: MerchantSelectorProps) {
  const { fetchWithHousehold, postWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newMerchantName, setNewMerchantName] = useState('');
  const [creatingMerchant, setCreatingMerchant] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [totalMerchants, setTotalMerchants] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    const fetchMerchants = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          limit: '30',
          offset: '0',
        });
        if (debouncedSearchQuery.length >= 2) {
          params.set('q', debouncedSearchQuery);
        }

        const response = await fetchWithHousehold(`/api/merchants?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          const merchantRows = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
          setMerchants(merchantRows);
          setTotalMerchants(typeof data?.total === 'number' ? data.total : merchantRows.length);
        }
      } catch (error) {
        console.error('Failed to fetch merchants:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMerchants();
  }, [selectedHouseholdId, fetchWithHousehold, debouncedSearchQuery]);

  // Notify parent when merchant exemption status changes
  useEffect(() => {
    if (onMerchantExemptChange) {
      const selected = merchants.find(m => m.id === selectedMerchant);
      onMerchantExemptChange(selected?.isSalesTaxExempt || false);
    }
  }, [selectedMerchant, merchants, onMerchantExemptChange]);

  const loadMoreMerchants = async () => {
    if (!selectedHouseholdId) {
      return;
    }

    try {
      setLoadingMore(true);
      const nextOffset = merchants.length;
      const params = new URLSearchParams({
        limit: '30',
        offset: String(nextOffset),
      });
      if (debouncedSearchQuery.length >= 2) {
        params.set('q', debouncedSearchQuery);
      }

      const response = await fetchWithHousehold(`/api/merchants?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const merchantRows = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        setMerchants((prev) => [...prev, ...merchantRows]);
        setTotalMerchants(typeof data?.total === 'number' ? data.total : totalMerchants);
      }
    } catch (error) {
      console.error('Failed to load more merchants:', error);
      toast.error('Failed to load more merchants');
    } finally {
      setLoadingMore(false);
    }
  };

  const selectedMerchantName = merchants.find((m) => m.id === selectedMerchant)?.name;
  const canLoadMore = merchants.length < totalMerchants;

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
        // Use flushSync to ensure merchants state updates synchronously
        flushSync(() => {
          setMerchants([...merchants, newMerchant]);
        });
        // Use setTimeout to ensure parent state updates propagate
        // before switching back to Select view
        setTimeout(() => {
          onMerchantChange(newMerchant.id);
          setNewMerchantName('');
          setIsCreating(false);
        }, 0);
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
      {/* Keep Select mounted but hidden during creation to preserve controlled value state */}
      <div className={`flex gap-2 ${isCreating ? 'hidden' : ''}`}>
        <div className="flex-1 space-y-2">
          <Input
            type="text"
            placeholder="Search merchants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-elevated border border-border text-foreground rounded-lg"
          />
          <Select value={selectedMerchant || ''} onValueChange={onMerchantChange}>
            <SelectTrigger className="bg-elevated border border-border text-foreground rounded-lg">
              <SelectValue placeholder={loading ? 'Loading merchants...' : 'Select or skip'}>
                {selectedMerchantName}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Skip (No merchant)</SelectItem>
              {merchants.map((merchant) => (
                <SelectItem key={merchant.id} value={merchant.id}>
                  <div className="flex items-center gap-2">
                    <span>{merchant.name}</span>
                    {merchant.isSalesTaxExempt && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 bg-success/10 text-success border-success/30">
                        Tax Exempt
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
              {!loading && merchants.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {debouncedSearchQuery.length >= 2 ? 'No merchants found' : 'No merchants yet'}
                </div>
              )}
              {canLoadMore && (
                <div className="px-2 py-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadMoreMerchants}
                    disabled={loadingMore}
                    className="w-full border-border"
                  >
                    {loadingMore ? 'Loading...' : `Load more (${merchants.length}/${totalMerchants})`}
                  </Button>
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
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
      {isCreating && (
        <div className="flex gap-2">
          <Input
            autoFocus
            type="text"
            placeholder="New merchant name..."
            value={newMerchantName}
            onChange={(e) => setNewMerchantName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-elevated border border-primary text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Button
            type="button"
            size="icon"
            onClick={handleCreateMerchant}
            disabled={creatingMerchant || !newMerchantName.trim()}
            className="bg-primary hover:opacity-90 text-primary-foreground"
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
