'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DollarSign } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
}

interface AccountSelectorProps {
  selectedAccountId: string | null;
  onAccountChange: (accountId: string) => void;
  label?: string;
  hideLabel?: boolean;
}

export function AccountSelector({
  selectedAccountId,
  onAccountChange,
  label = 'Account',
  hideLabel = false,
}: AccountSelectorProps) {
  const { fetchWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    const fetchAccounts = async () => {
      try {
        setLoading(true);
        const response = await fetchWithHousehold('/api/accounts');
        if (response.ok) {
          const data = await response.json();
          setAccounts(data);
          // Auto-select first account if none selected
          if (!selectedAccountId && data.length > 0) {
            onAccountChange(data[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [selectedAccountId, onAccountChange, selectedHouseholdId, fetchWithHousehold]);

  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId);

  return (
    <div className="space-y-2">
      {!hideLabel && <label className="text-sm font-medium text-foreground">{label}</label>}
      <Select value={selectedAccountId || ''} onValueChange={onAccountChange}>
        <SelectTrigger className="bg-card border border-border text-foreground rounded-lg">
          <SelectValue placeholder="Select account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              <div className="flex items-center gap-2 w-full">
                <DollarSign className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate">{account.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  ${account.currentBalance?.toFixed(2) || '0.00'}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedAccount && (
        <div className="p-3 bg-elevated rounded-lg border border-border">
          <p className="text-xs text-muted-foreground">Available Balance</p>
          <p className="text-lg font-semibold text-foreground">
            ${selectedAccount.currentBalance?.toFixed(2) || '0.00'}
          </p>
        </div>
      )}
    </div>
  );
}
