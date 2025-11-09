'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { AccountForm } from '@/components/accounts/account-form';
import { AccountCard } from '@/components/accounts/account-card';

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
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/accounts');
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
  }, []);

  // Create or update account
  const handleSubmit = async (formData: any) => {
    try {
      setIsSubmitting(true);

      const url = selectedAccount ? `/api/accounts/${selectedAccount.id}` : '/api/accounts';
      const method = selectedAccount ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok || response.status === 201) {
        const result = await response.json();
        toast.success(selectedAccount ? 'Account updated successfully' : 'Account created successfully');

        // Refresh accounts list
        const fetchResponse = await fetch('/api/accounts');
        if (fetchResponse.ok) {
          const data = await fetchResponse.json();
          setAccounts(data);
          // Close dialog and reset
          setIsDialogOpen(false);
          setSelectedAccount(null);
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
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Account deleted successfully');
        setAccounts(accounts.filter((acc) => acc.id !== accountId));
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

  // Calculate totals
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
  const savingsAccounts = accounts.filter((acc) => acc.type === 'savings');
  const savingsTotal = savingsAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0);

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
          <Button
            onClick={handleNewAccount}
            className="bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 font-medium"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Account
          </Button>
        </div>

        {/* Summary Cards */}
        {accounts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Total Balance */}
            <div className="p-6 border border-border bg-card rounded-xl">
              <p className="text-muted-foreground text-sm mb-2">Total Balance</p>
              <h3 className="text-3xl font-bold text-foreground">
                ${totalBalance.toFixed(2)}
              </h3>
              <p className="text-muted-foreground text-xs mt-3">Across all accounts</p>
            </div>

            {/* Accounts Count */}
            <div className="p-6 border border-border bg-card rounded-xl">
              <p className="text-muted-foreground text-sm mb-2">Total Accounts</p>
              <h3 className="text-3xl font-bold text-foreground">{accounts.length}</h3>
              <p className="text-muted-foreground text-xs mt-3">Active accounts</p>
            </div>

            {/* Savings Total */}
            {savingsAccounts.length > 0 && (
              <div className="p-6 border border-border bg-card rounded-xl">
                <p className="text-muted-foreground text-sm mb-2">Savings Total</p>
                <h3 className="text-3xl font-bold text-[var(--color-income)]">
                  ${savingsTotal.toFixed(2)}
                </h3>
                <p className="text-muted-foreground text-xs mt-3">{savingsAccounts.length} savings account(s)</p>
              </div>
            )}
          </div>
        )}

        {/* Accounts Grid */}
        {accounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={handleEditAccount}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="p-12 border border-border bg-card rounded-xl text-center">
            <p className="text-muted-foreground mb-4">No accounts yet. Create your first account to get started.</p>
            <Button
              onClick={handleNewAccount}
              className="bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 font-medium"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create First Account
            </Button>
          </div>
        )}

        {/* Create/Edit Account Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-card border border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {selectedAccount ? 'Edit Account' : 'Create New Account'}
              </DialogTitle>
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
