'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, BarChart3, ChevronDown, ChevronUp, ArrowLeft, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import { AccountForm } from '@/components/accounts/account-form';
import { AccountGroupSection } from '@/components/accounts/account-group-section';
import { UtilizationTrendsChart, BalanceHistoryChart } from '@/components/charts';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { useBusinessFeatures } from '@/contexts/business-features-context';
import { HouseholdLoadingState } from '@/components/household/household-loading-state';
import { NoHouseholdError } from '@/components/household/no-household-error';
import { useHouseholdAccounts } from '@/components/accounts/hooks/use-household-accounts';

interface Account {
  id: string;
  name: string;
  type: string;
  bankName?: string;
  accountNumberLast4?: string;
  currentBalance: number;
  creditLimit?: number;
  color: string;
  icon: string;
  interestRate?: number;
  interestType?: 'fixed' | 'variable';
  includeInPayoffStrategy?: boolean;
  statementBalance?: number;
  statementDueDate?: string;
  minimumPaymentAmount?: number;
  drawPeriodEndDate?: string;
  repaymentPeriodEndDate?: string;
}

const CASH_ACCOUNT_TYPES = ['checking', 'savings', 'cash', 'investment'];
const CREDIT_ACCOUNT_TYPES = ['credit', 'line_of_credit'];

export default function AccountsPage() {
  const { initialized, loading: householdLoading, selectedHouseholdId: householdId } = useHousehold();
  const { refresh: refreshBusinessFeatures } = useBusinessFeatures();
  const {
    fetchWithHousehold,
    postWithHousehold,
    putWithHousehold,
    deleteWithHousehold,
    selectedHouseholdId
  } = useHouseholdFetch();
  const {
    accounts: householdAccounts,
    loading,
    refetch: refetchAccounts,
  } = useHouseholdAccounts({
    enabled: initialized && !householdLoading && Boolean(selectedHouseholdId && householdId),
    fetchWithHousehold,
    emptySelectionMessage: 'No household selected',
  });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setAccounts(householdAccounts as Account[]);
  }, [householdAccounts]);

  const handleSubmit = async (formData: Record<string, unknown>, saveMode: 'save' | 'saveAndAdd' = 'save') => {
    try {
      setIsSubmitting(true);
      const url = selectedAccount ? `/api/accounts/${selectedAccount.id}` : '/api/accounts';
      const response = selectedAccount
        ? await putWithHousehold(url, formData)
        : await postWithHousehold(url, formData);

      if (response.ok || response.status === 201) {
        await response.json();
        if (saveMode === 'saveAndAdd') {
          const accountName = typeof formData.name === 'string' ? formData.name : 'Account';
          toast.success(`Account "${accountName}" saved successfully!`);
        } else {
          toast.success(selectedAccount ? 'Account updated successfully' : 'Account created successfully');
        }
        const refreshedAccounts = await refetchAccounts();
        setAccounts(refreshedAccounts as Account[]);
        await refreshBusinessFeatures();
        if (saveMode === 'save') {
          setIsDialogOpen(false);
          setSelectedAccount(null);
        }
      } else {
        let errorMessage = selectedAccount ? 'Failed to update account' : 'Failed to create account';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          errorMessage = `Failed with status ${response.status}`;
        }
        toast.error(errorMessage);
        console.error('Account creation failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error(`Error ${selectedAccount ? 'updating' : 'creating'} account:`, error);
      toast.error(error instanceof Error ? error.message : `Error ${selectedAccount ? 'updating' : 'creating'} account`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (accountId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this account? All associated transactions will remain in the system.'
      )
    ) {
      return;
    }
    try {
      const response = await deleteWithHousehold(`/api/accounts/${accountId}`);
      if (response.ok) {
        toast.success('Account deleted successfully');
        setAccounts(accounts.filter((acc) => acc.id !== accountId));
        await refreshBusinessFeatures();
      } else {
        toast.error('Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Error deleting account');
    }
  };

  const handleNewAccount = () => {
    setSelectedAccount(null);
    setIsDialogOpen(true);
  };

  const handleEditAccount = (account: Account) => {
    setSelectedAccount(account);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedAccount(null);
  };

  const { cashAccounts, creditAccounts } = useMemo(() => {
    const cash = accounts.filter((acc) => CASH_ACCOUNT_TYPES.includes(acc.type));
    const credit = accounts.filter((acc) => CREDIT_ACCOUNT_TYPES.includes(acc.type));
    return { cashAccounts: cash, creditAccounts: credit };
  }, [accounts]);

  const {
    totalBalance,
    cashTotal,
    creditBalance,
    totalCreditLimit,
    availableCredit,
    overallUtilization
  } = useMemo(() => {
    const cashSum = cashAccounts.reduce(
      (sum, acc) => new Decimal(sum).plus(new Decimal(acc.currentBalance || 0)).toNumber(),
      0
    );
    const creditSum = creditAccounts.reduce(
      (sum, acc) => new Decimal(sum).plus(new Decimal(Math.abs(acc.currentBalance || 0))).toNumber(),
      0
    );
    const limitSum = creditAccounts.reduce(
      (sum, acc) => new Decimal(sum).plus(new Decimal(acc.creditLimit || 0)).toNumber(),
      0
    );
    const available = new Decimal(limitSum).minus(new Decimal(creditSum)).toNumber();
    const utilization = limitSum > 0 ? new Decimal(creditSum).div(limitSum).times(100).toNumber() : 0;
    const total = new Decimal(cashSum).minus(new Decimal(creditSum)).toNumber();

    return {
      totalBalance: total,
      cashTotal: cashSum,
      creditBalance: creditSum,
      totalCreditLimit: limitSum,
      availableCredit: available,
      overallUtilization: utilization,
    };
  }, [cashAccounts, creditAccounts]);

  if (!initialized || householdLoading) {
    return <HouseholdLoadingState />;
  }

  if (!selectedHouseholdId || !householdId) {
    return <NoHouseholdError />;
  }

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hasCredit = creditAccounts.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <header className="sticky top-0 z-50">
          <div
            className="backdrop-blur-xl"
            style={{ backgroundColor: 'color-mix(in oklch, var(--color-background) 82%, transparent)' }}
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
              <div className="h-4 w-24 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
            </div>
          </div>
          <div className="h-px" style={{ backgroundColor: 'var(--color-border)' }} />
        </header>
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            <div className="grid grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="p-4 space-y-2" style={{ borderRight: i < 3 ? '1px solid var(--color-border)' : 'none' }}>
                  <div className="h-2.5 w-16 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
                  <div className="h-5 w-24 rounded animate-pulse" style={{ backgroundColor: 'var(--color-elevated)' }} />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-32 rounded-xl animate-pulse"
                style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}
              />
            ))}
          </div>
        </main>
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
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <h1 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>Accounts</h1>
            </div>
            <div className="flex items-center gap-2">
              {hasCredit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCharts(!showCharts);
                    if (!showCharts) setRefreshKey(prev => prev + 1);
                  }}
                  className="rounded-lg"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  <BarChart3 className="w-4 h-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">{showCharts ? 'Hide' : ''} Trends</span>
                  {showCharts ? (
                    <ChevronUp className="w-3.5 h-3.5 ml-1" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 ml-1" />
                  )}
                </Button>
              )}
              <Button
                onClick={handleNewAccount}
                size="sm"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                className="hover:opacity-90 font-medium rounded-lg"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Add Account</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </div>
        <div
          className="h-px"
          style={{
            background: 'linear-gradient(to right, transparent 5%, var(--color-border) 20%, color-mix(in oklch, var(--color-primary) 45%, var(--color-border)) 50%, var(--color-border) 80%, transparent 95%)',
          }}
        />
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary stats bar */}
        {accounts.length > 0 && (
          <div
            className="rounded-xl border overflow-hidden mb-8"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            <div className={`grid ${hasCredit ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}>
              {/* Net Worth */}
              <div
                className="p-4"
                style={{ borderRight: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}
              >
                <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Net Worth</p>
                <p className="text-xl font-bold font-mono tabular-nums" style={{ color: totalBalance >= 0 ? 'var(--color-income)' : 'var(--color-destructive)' }}>
                  ${fmt(totalBalance)}
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Cash minus credit</p>
              </div>

              {/* Cash Balance */}
              <div
                className="p-4"
                style={{ borderRight: hasCredit ? '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' : 'none' }}
              >
                <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Cash</p>
                <p className="text-xl font-bold font-mono tabular-nums" style={{ color: 'var(--color-income)' }}>
                  ${fmt(cashTotal)}
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  {cashAccounts.length} account{cashAccounts.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Credit Used */}
              {hasCredit && (
                <div
                  className="p-4"
                  style={{ borderRight: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}
                >
                  <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Credit Used</p>
                  <p className="text-xl font-bold font-mono tabular-nums" style={{ color: 'var(--color-destructive)' }}>
                    ${fmt(creditBalance)}
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted-foreground)' }}>{overallUtilization.toFixed(0)}% utilization</p>
                </div>
              )}

              {/* Available Credit */}
              {hasCredit && (
                <div className="p-4">
                  <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Available</p>
                  <p className="text-xl font-bold font-mono tabular-nums" style={{ color: availableCredit >= 0 ? 'var(--color-success)' : 'var(--color-destructive)' }}>
                    ${fmt(availableCredit)}
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                    of ${totalCreditLimit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} limit
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Charts */}
        {showCharts && hasCredit && (
          <div className="mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <UtilizationTrendsChart key={`utilization-${refreshKey}`} />
              <BalanceHistoryChart key={`balance-${refreshKey}`} />
            </div>
          </div>
        )}

        {/* Empty State */}
        {accounts.length === 0 && (
          <div
            className="rounded-xl border py-16 text-center"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
              style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 15%, transparent)' }}
            >
              <Landmark className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <p className="font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No accounts yet</p>
            <p className="text-sm mb-6" style={{ color: 'var(--color-muted-foreground)' }}>Create your first account to start tracking balances.</p>
            <Button
              onClick={handleNewAccount}
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                className="hover:opacity-90 font-medium rounded-lg"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create First Account
            </Button>
          </div>
        )}

        {/* Cash & Debit Accounts */}
        <AccountGroupSection
          title="Cash & Debit"
          accounts={cashAccounts}
          totalLabel="Total Cash"
          totalValue={`$${fmt(cashTotal)}`}
          totalColor="var(--color-income)"
          onEdit={handleEditAccount}
          onDelete={handleDelete}
        />

        {/* Credit Accounts */}
        <AccountGroupSection
          title="Credit"
          accounts={creditAccounts}
          totalLabel="Balance Owed"
          totalValue={`$${fmt(creditBalance)}`}
          totalColor="var(--color-error)"
          secondaryTotal={{
            label: 'Available',
            value: `$${fmt(availableCredit)}`,
            color: availableCredit >= 0 ? 'var(--color-success)' : 'var(--color-error)',
          }}
          onEdit={handleEditAccount}
          onDelete={handleDelete}
        />

        {/* Create/Edit Account Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
            <DialogHeader>
              <DialogTitle style={{ color: 'var(--color-foreground)' }}>
                {selectedAccount ? 'Edit Account' : 'Create New Account'}
              </DialogTitle>
              <DialogDescription style={{ color: 'var(--color-muted-foreground)' }}>
                Set up a financial account to track your transactions and balances
              </DialogDescription>
            </DialogHeader>
            <AccountForm
              account={selectedAccount}
              onSubmit={handleSubmit}
              onCancel={handleCloseDialog}
              isLoading={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
