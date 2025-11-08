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

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance: number;
}

interface AccountSelectorProps {
  selectedAccountId: string | null;
  onAccountChange: (accountId: string) => void;
}

export function AccountSelector({
  selectedAccountId,
  onAccountChange,
}: AccountSelectorProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/accounts');
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
  }, [selectedAccountId, onAccountChange]);

  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-white">Account</label>
      <Select value={selectedAccountId || ''} onValueChange={onAccountChange}>
        <SelectTrigger className="bg-[#1a1a1a] border border-[#2a2a2a] text-white rounded-lg">
          <SelectValue placeholder="Select account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>{account.name}</span>
                <span className="text-xs text-gray-400 ml-2">
                  ${account.currentBalance?.toFixed(2) || '0.00'}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedAccount && (
        <div className="p-3 bg-[#242424] rounded-lg border border-[#2a2a2a]">
          <p className="text-xs text-gray-500">Available Balance</p>
          <p className="text-lg font-semibold text-white">
            ${selectedAccount.currentBalance?.toFixed(2) || '0.00'}
          </p>
        </div>
      )}
    </div>
  );
}
