'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
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
  // Credit-specific fields
  interestRate?: number;
  interestType?: 'fixed' | 'variable';
  includeInPayoffStrategy?: boolean;
  statementBalance?: number;
  statementDueDate?: string;
  minimumPaymentAmount?: number;
  // Line of credit fields
  drawPeriodEndDate?: string;
  repaymentPeriodEndDate?: string;
}

// Account type groupings
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

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch accounts
  useEffect(() => {
    // Don't fetch if household context isn't initialized yet
    if (!initialized || householdLoading) {
      return;
    }

    // Don't fetch if no household is selected
    if (!selectedHouseholdId || !householdId) {
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
        } else {
          toast.error('Failed to load accounts');
        }
      } catch (error) {
        console.error('Error fetching accounts:', error);
        toast.error('Error loading accounts');
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [initialized, householdLoading, selectedHouseholdId, householdId, fetchWithHousehold]);

  // Create or update account
  const handleSubmit = async (formData: Record<string, unknown>, saveMode: 'save' | 'saveAndAdd' = 'save') => {
    try {
      setIsSubmitting(true);

      const url = selectedAccount ? `/api/accounts/${selectedAccount.id}` : '/api/accounts';
      const response = selectedAccount
        ? await putWithHousehold(url, formData)
        : await postWithHousehold(url, formData);

      if (response.ok || response.status === 201) {
        await response.json();

        // Show appropriate toast message
        if (saveMode === 'saveAndAdd') {
          const accountName = typeof formData.name === 'string' ? formData.name : 'Account';
          toast.success(`Account "${accountName}" saved successfully!`);
        } else {
          toast.success(selectedAccount ? 'Account updated successfully' : 'Account created successfully');
        }

        // Refresh accounts list
        const fetchResponse = await fetchWithHousehold('/api/accounts');
        if (fetchResponse.ok) {
          const data = await fetchResponse.json();
          setAccounts(data);

          // Refresh business features context in case business account status changed
          await refreshBusinessFeatures();

          // Only close dialog for regular save, keep open for save & add another
          if (saveMode === 'save') {
            setIsDialogOpen(false);
            setSelectedAccount(null);
          }
        } else {
          toast.error(`Account ${selectedAccount ? 'updated' : 'created'} but failed to refresh list`);
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

  // Delete account
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

        // Refresh business features context in case business account was deleted
        await refreshBusinessFeatures();
      } else {
        toast.error('Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Error deleting account');
    }
  };

  // Open create dialog
  const handleNewAccount = () => {
    setSelectedAccount(null);
    setIsDialogOpen(true);
  };

  // Open edit dialog
  const handleEditAccount = (account: Account) => {
    setSelectedAccount(account);
    setIsDialogOpen(true);
  };

  // Close dialog
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedAccount(null);
  };

  // Group accounts by type
  const { cashAccounts, creditAccounts } = useMemo(() => {
    const cash = accounts.filter((acc) => CASH_ACCOUNT_TYPES.includes(acc.type));
    const credit = accounts.filter((acc) => CREDIT_ACCOUNT_TYPES.includes(acc.type));
    return { cashAccounts: cash, creditAccounts: credit };
  }, [accounts]);

  // Calculate totals using Decimal.js
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

  // Show loading state while household context initializes
  if (!initialized || householdLoading) {
    return <HouseholdLoadingState />;
  }

  // Show error state if no household is selected
  if (!selectedHouseholdId || !householdId) {
    return <NoHouseholdError />;
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-elevated rounded-lg w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-48 bg-elevated rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Accounts</h1>
            <p className="text-muted-foreground">Manage your financial accounts and track balances</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Show Charts Toggle - only visible if credit accounts exist */}
            {creditAccounts.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowCharts(!showCharts);
                  if (!showCharts) setRefreshKey(prev => prev + 1);
                }}
                className="border-border hover:bg-elevated"
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                {showCharts ? 'Hide' : 'Show'} Trends
                {showCharts ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              onClick={handleNewAccount}
              className="bg-primary text-primary-foreground hover:opacity-90 font-medium"
            >
              <Plus className="mr-2 h-5 w-5" />
              Add Account
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {accounts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {/* Net Worth */}
            <div className="p-5 border border-border bg-card rounded-xl">
              <p className="text-muted-foreground text-sm mb-2">Net Worth</p>
              <h3 className={`text-2xl font-bold font-mono ${totalBalance >= 0 ? 'text-income' : 'text-error'}`}>
                ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-muted-foreground text-xs mt-2">Cash minus credit used</p>
            </div>

            {/* Cash Balance */}
            <div className="p-5 border border-border bg-card rounded-xl">
              <p className="text-muted-foreground text-sm mb-2">Cash Balance</p>
              <h3 className="text-2xl font-bold font-mono text-income">
                ${cashTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-muted-foreground text-xs mt-2">{cashAccounts.length} account{cashAccounts.length !== 1 ? 's' : ''}</p>
            </div>

            {/* Credit Used */}
            {creditAccounts.length > 0 && (
              <div className="p-5 border border-border bg-card rounded-xl">
                <p className="text-muted-foreground text-sm mb-2">Credit Used</p>
                <h3 className="text-2xl font-bold font-mono text-error">
                  ${creditBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-muted-foreground text-xs mt-2">{overallUtilization.toFixed(0)}% utilization</p>
              </div>
            )}

            {/* Available Credit */}
            {creditAccounts.length > 0 && (
              <div className="p-5 border border-border bg-card rounded-xl">
                <p className="text-muted-foreground text-sm mb-2">Available Credit</p>
                <h3 className={`text-2xl font-bold font-mono ${availableCredit >= 0 ? 'text-success' : 'text-error'}`}>
                  ${availableCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p className="text-muted-foreground text-xs mt-2">of ${totalCreditLimit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} limit</p>
              </div>
            )}
          </div>
        )}

        {/* Credit Utilization & Balance History Charts */}
        {showCharts && creditAccounts.length > 0 && (
          <div className="mb-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UtilizationTrendsChart key={`utilization-${refreshKey}`} />
              <BalanceHistoryChart key={`balance-${refreshKey}`} />
            </div>
          </div>
        )}

        {/* Empty State */}
        {accounts.length === 0 && (
          <div className="p-12 border border-border bg-card rounded-xl text-center">
            <p className="text-muted-foreground mb-4">No accounts yet. Create your first account to get started.</p>
            <Button
              onClick={handleNewAccount}
              className="bg-primary text-primary-foreground hover:opacity-90 font-medium"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create First Account
            </Button>
          </div>
        )}

        {/* Cash & Debit Accounts Section */}
        <AccountGroupSection
          title="Cash & Debit Accounts"
          subtitle="Checking, savings, cash, and investment accounts"
          accounts={cashAccounts}
          totalLabel="Total Cash"
          totalValue={`$${cashTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          totalColor="var(--color-income)"
          onEdit={handleEditAccount}
          onDelete={handleDelete}
        />

        {/* Credit Accounts Section */}
        <AccountGroupSection
          title="Credit Accounts"
          subtitle="Credit cards and lines of credit"
          accounts={creditAccounts}
          totalLabel="Balance Owed"
          totalValue={`$${creditBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          totalColor="var(--color-error)"
          secondaryTotal={{
            label: 'Available Credit',
            value: `$${availableCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            color: availableCredit >= 0 ? 'var(--color-success)' : 'var(--color-error)',
          }}
          onEdit={handleEditAccount}
          onDelete={handleDelete}
        />

        {/* Create/Edit Account Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-card border border-border max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {selectedAccount ? 'Edit Account' : 'Create New Account'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
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
      </div>
    </div>
  );
}
