'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { TransferList } from '@/components/transfers/transfer-list';
import { QuickTransferModal } from '@/components/transfers/quick-transfer-modal';
import { Plus } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { HouseholdLoadingState } from '@/components/household/household-loading-state';
import { NoHouseholdError } from '@/components/household/no-household-error';

interface Account {
  id: string;
  name: string;
  currentBalance: number;
  color?: string;
}

interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  fromAccountName: string;
  toAccountName: string;
  amount: string | number;
  description: string;
  date: string;
  status: 'pending' | 'completed' | 'failed';
  fees?: string | number;
  notes?: string;
  createdAt: string;
}

export default function TransfersPage() {
  const { initialized, loading: householdLoading, selectedHouseholdId: householdId } = useHousehold();
  const { fetchWithHousehold, selectedHouseholdId } = useHouseholdFetch();
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load accounts and transfers
  useEffect(() => {
    // Don't fetch if household context isn't initialized yet
    if (!initialized || householdLoading) {
      return;
    }

    // Don't fetch if no household is selected
    if (!selectedHouseholdId || !householdId) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load accounts
        const accountsRes = await fetchWithHousehold('/api/accounts');
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          setAccounts(accountsData || []);
        }

        // Load transfers
        const transfersRes = await fetchWithHousehold('/api/transfers?limit=50');
        if (transfersRes.ok) {
          const transfersData = await transfersRes.json();
          setTransfers(transfersData.transfers || []);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [initialized, householdLoading, selectedHouseholdId, householdId, fetchWithHousehold]);

  const loadTransfers = async () => {
    try {
      const response = await fetchWithHousehold('/api/transfers?limit=50');
      if (response.ok) {
        const data = await response.json();
        setTransfers(data.transfers || []);
      }
    } catch (error) {
      console.error('Error loading transfers:', error);
    }
  };

  const handleTransferSuccess = () => {
    setIsModalOpen(false);
    loadTransfers();
  };

  // Show loading state while household context initializes
  if (!initialized || householdLoading) {
    return <HouseholdLoadingState />;
  }

  // Show error state if no household is selected
  if (!selectedHouseholdId || !householdId) {
    return <NoHouseholdError />;
  }

  // Show skeleton loading while fetching data
  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-elevated rounded-lg w-1/3"></div>
            <div className="h-6 bg-elevated rounded-lg w-1/4"></div>
            <div className="mt-6 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-elevated rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Transfers</h1>
          <p className="text-muted-foreground mt-2">
            Move money between your accounts
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          disabled={accounts.length < 2}
          className="bg-(--color-primary) hover:opacity-90 text-(--color-primary-foreground)"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Transfer
        </Button>
      </div>

      {accounts.length < 2 && (
        <div className="bg-(--color-warning)/10 border border-(--color-warning)/20 rounded-lg p-4">
          <p className="text-(--color-warning)">
            You need at least 2 accounts to create transfers.
          </p>
        </div>
      )}

      {/* Transfer List */}
      <TransferList
        transfers={transfers}
        isLoading={isLoading}
        onRefresh={loadTransfers}
      />

      {/* Quick Transfer Modal */}
      <QuickTransferModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        accounts={accounts}
        onSuccess={handleTransferSuccess}
      />
      </div>
    </div>
  );
}
