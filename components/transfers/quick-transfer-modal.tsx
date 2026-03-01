'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { TransferForm } from './transfer-form';
import { Loader2 } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

interface Account {
  id: string;
  name: string;
  currentBalance: number;
  color?: string;
}

interface SuggestedPair {
  fromAccountId: string;
  toAccountId: string;
  fromAccountName: string;
  toAccountName: string;
  usageCount: number;
}

interface QuickTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onSuccess?: () => void;
}

export function QuickTransferModal({
  open,
  onOpenChange,
  accounts,
  onSuccess,
}: QuickTransferModalProps) {
  const { fetchWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [suggestedPairs, setSuggestedPairs] = useState<SuggestedPair[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  useEffect(() => {
    if (!open || !selectedHouseholdId) return;

    const loadSuggestions = async () => {
      try {
        setIsLoadingSuggestions(true);
        const response = await fetchWithHousehold('/api/transfers/suggest?limit=5');
        if (!response.ok) throw new Error('Failed to load suggestions');
        const data = await response.json();
        setSuggestedPairs(data.suggestions || []);
      } catch (error) {
        console.error('Error loading transfer suggestions:', error);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    loadSuggestions();
  }, [open, selectedHouseholdId, fetchWithHousehold]);

  const handleSuccess = (_transferId: string) => {
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden"
        style={{
          maxWidth: '460px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-background)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          boxShadow: '0 24px 80px color-mix(in oklch, var(--color-background) 10%, black 40%)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 pt-5 pb-4 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
        >
          <DialogTitle className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
            New Transfer
          </DialogTitle>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
            Move money between accounts
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingSuggestions ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-primary)' }} />
            </div>
          ) : (
            <TransferForm
              accounts={accounts}
              suggestedPairs={suggestedPairs}
              onSuccess={handleSuccess}
              onCancel={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
