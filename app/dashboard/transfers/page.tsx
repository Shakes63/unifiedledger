'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { TransferList } from '@/components/transfers/transfer-list';
import { QuickTransferModal } from '@/components/transfers/quick-transfer-modal';
import { Loader2, Plus } from 'lucide-react';

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
  const { isLoaded } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load accounts
        const accountsRes = await fetch('/api/accounts');
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          setAccounts(accountsData.accounts || []);
        }

        // Load transfers
        loadTransfers();
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isLoaded]);

  const loadTransfers = async () => {
    try {
      const response = await fetch('/api/transfers?limit=50');
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

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Transfers</h1>
          <p className="text-[#9ca3af] mt-2">
            Move money between your accounts
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          disabled={accounts.length < 2}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Transfer
        </Button>
      </div>

      {accounts.length < 2 && (
        <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg p-4">
          <p className="text-amber-400">
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
      />
      </div>
    </div>
  );
}
