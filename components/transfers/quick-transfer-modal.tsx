'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TransferForm } from './transfer-form';
import { Loader2 } from 'lucide-react';

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
}

export function QuickTransferModal({
  open,
  onOpenChange,
  accounts,
}: QuickTransferModalProps) {
  const [suggestedPairs, setSuggestedPairs] = useState<SuggestedPair[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  useEffect(() => {
    if (!open) return;

    const loadSuggestions = async () => {
      try {
        setIsLoadingSuggestions(true);
        const response = await fetch('/api/transfers/suggest?limit=5');

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
  }, [open]);

  const handleSuccess = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0a] border-[#2a2a2a] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">New Transfer</DialogTitle>
          <DialogDescription className="text-[#9ca3af]">
            Transfer money between your accounts
          </DialogDescription>
        </DialogHeader>

        {isLoadingSuggestions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : (
          <TransferForm
            accounts={accounts}
            suggestedPairs={suggestedPairs}
            onSuccess={handleSuccess}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
