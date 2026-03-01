'use client';

import { useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DollarSign } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHouseholdAccounts } from '@/components/accounts/hooks/use-household-accounts';

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
  const { accounts } = useHouseholdAccounts({
    enabled: Boolean(selectedHouseholdId),
    fetchWithHousehold,
    emptySelectionMessage: 'No household selected',
  });

  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      onAccountChange(accounts[0].id);
    }
  }, [selectedAccountId, onAccountChange, accounts]);

  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId);

  return (
    <div className="space-y-2">
      {!hideLabel && <label className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>{label}</label>}
      <Select value={selectedAccountId || ''} onValueChange={onAccountChange}>
        <SelectTrigger className="border rounded-lg" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
          <SelectValue placeholder="Select account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              <div className="flex items-center gap-2 w-full">
                <DollarSign className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">{account.name}</span>
                <span className="text-xs shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
                  ${account.currentBalance?.toFixed(2) || '0.00'}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedAccount && (
        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
          <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Available Balance</p>
          <p className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>
            ${selectedAccount.currentBalance?.toFixed(2) || '0.00'}
          </p>
        </div>
      )}
    </div>
  );
}
