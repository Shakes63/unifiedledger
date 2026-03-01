'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowLeftRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TransferList } from '@/components/transfers/transfer-list';
import { QuickTransferModal } from '@/components/transfers/quick-transfer-modal';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { HouseholdLoadingState } from '@/components/household/household-loading-state';
import { NoHouseholdError } from '@/components/household/no-household-error';
import { useHouseholdAccounts } from '@/components/accounts/hooks/use-household-accounts';

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
  const { accounts: householdAccounts, loading: accountsLoading } = useHouseholdAccounts({
    enabled: initialized && !householdLoading && Boolean(selectedHouseholdId && householdId),
    fetchWithHousehold,
    emptySelectionMessage: 'No household selected',
  });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setAccounts(householdAccounts as Account[]);
  }, [householdAccounts]);

  useEffect(() => {
    if (!initialized || householdLoading) return;
    if (!selectedHouseholdId || !householdId) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);
        const transfersRes = await fetchWithHousehold('/api/transfers?limit=50');
        if (transfersRes.ok) {
          const data = await transfersRes.json();
          setTransfers(data.transfers || []);
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

  if (!initialized || householdLoading) return <HouseholdLoadingState />;
  if (!selectedHouseholdId || !householdId) return <NoHouseholdError />;

  if (isLoading || accountsLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        {/* Skeleton header */}
        <div style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="w-24 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
            <div className="w-32 h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--color-background)', animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Sticky header */}
      <header className="sticky top-0 z-50">
        <div
          className="backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
                  Transfers
                </h1>
                {transfers.length > 0 && (
                  <span
                    className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'color-mix(in oklch, var(--color-border) 60%, transparent)',
                      color: 'var(--color-muted-foreground)',
                    }}
                  >
                    {transfers.length}
                  </span>
                )}
              </div>
            </div>

            <Button
              onClick={() => setIsModalOpen(true)}
              disabled={accounts.length < 2}
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs font-medium"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-primary-foreground)',
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              New Transfer
            </Button>
          </div>
        </div>
        <div
          className="h-px"
          style={{
            background: 'linear-gradient(to right, transparent 5%, var(--color-border) 20%, color-mix(in oklch, var(--color-primary) 45%, var(--color-border)) 50%, var(--color-border) 80%, transparent 95%)',
          }}
        />
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Needs-2-accounts warning */}
        {accounts.length < 2 && (
          <div
            className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3 text-sm"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--color-warning) 8%, transparent)',
              border: '1px solid color-mix(in oklch, var(--color-warning) 25%, transparent)',
              color: 'var(--color-warning)',
            }}
          >
            <ArrowLeftRight className="w-4 h-4 shrink-0" />
            You need at least 2 accounts to create transfers.
          </div>
        )}

        <TransferList
          transfers={transfers}
          isLoading={isLoading}
          onRefresh={loadTransfers}
        />
      </main>

      <QuickTransferModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        accounts={accounts}
        onSuccess={handleTransferSuccess}
      />
    </div>
  );
}
