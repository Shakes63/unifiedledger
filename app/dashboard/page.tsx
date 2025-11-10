'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, TrendingUp, DollarSign, Wallet } from 'lucide-react';
import Link from 'next/link';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { BillsWidget } from '@/components/dashboard/bills-widget';
import { DebtCountdownCard } from '@/components/dashboard/debt-countdown-card';
import { BudgetSurplusCard } from '@/components/dashboard/budget-surplus-card';
import { CreditUtilizationWidget } from '@/components/debts/credit-utilization-widget';
import { useAuth } from '@clerk/nextjs';
import Decimal from 'decimal.js';

interface Account {
  id: string;
  name: string;
  currentBalance: number;
  accountNumberLast4: string | null;
  type: string;
  color: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  date: string;
  categoryId: string | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

export default function DashboardPage() {
  const { isLoaded } = useAuth();
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [monthlySpending, setMonthlySpending] = useState<number>(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize user on first load
    const initializeUser = async () => {
      try {
        const response = await fetch('/api/auth/init', {
          method: 'POST',
        });
        if (response.ok) {
          console.log('User initialized');
        }
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    if (isLoaded) {
      initializeUser();
    }
  }, [isLoaded]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch accounts to calculate total balance
        const accountsResponse = await fetch('/api/accounts');
        if (accountsResponse.ok) {
          const accountsData: Account[] = await accountsResponse.json();
          setAccounts(accountsData);
          const total = accountsData.reduce((sum, account) => {
            return new Decimal(sum).plus(new Decimal(account.currentBalance || 0)).toNumber();
          }, 0);
          setTotalBalance(total);
        }

        // Fetch transactions
        const txResponse = await fetch('/api/transactions?limit=1000');
        if (txResponse.ok) {
          const txData: Transaction[] = await txResponse.json();
          setTransactions(txData);
        }

        // Fetch categories
        const categoriesResponse = await fetch('/api/categories');
        if (categoriesResponse.ok) {
          const categoriesData: Category[] = await categoriesResponse.json();
          // Filter for expense categories only
          const expenseCategories = categoriesData.filter(cat =>
            cat.type === 'variable_expense' ||
            cat.type === 'monthly_bill' ||
            cat.type === 'non_monthly_bill'
          );
          setCategories(expenseCategories);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Calculate monthly spending based on selected category
  useEffect(() => {
    if (transactions.length === 0) return;

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Filter for current month expenses
    let monthlyExpenses = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return tx.type === 'expense' &&
             txDate >= firstDayOfMonth &&
             txDate <= lastDayOfMonth;
    });

    // Filter by category if not "all"
    if (selectedCategory !== 'all') {
      monthlyExpenses = monthlyExpenses.filter(tx => tx.categoryId === selectedCategory);
    }

    const total = monthlyExpenses.reduce((sum, tx) => {
      return new Decimal(sum).plus(new Decimal(tx.amount || 0)).toNumber();
    }, 0);
    setMonthlySpending(total);
  }, [transactions, selectedCategory]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Overview Cards */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-6 text-foreground">Quick Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Monthly Spending Card */}
            <Card className="p-6 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-3">This Month</p>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full text-foreground" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Total Spending</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-3 ml-3 rounded-lg bg-[var(--color-expense)]/20">
                  <TrendingUp className="w-6 h-6 text-[var(--color-expense)]" />
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-bold text-foreground">
                  {loading ? '...' : `$${monthlySpending.toFixed(2)}`}
                </h3>
                <p className="text-xs text-muted-foreground mt-2">
                  {selectedCategory === 'all'
                    ? 'All categories'
                    : categories.find(c => c.id === selectedCategory)?.name || 'Category'}
                </p>
              </div>
            </Card>

            {/* Combined Total Balance + Accounts Card */}
            <Card className="p-6 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
              <div className="flex items-start justify-between mb-4">
                <p className="text-sm text-muted-foreground">Accounts</p>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total Balance</p>
                  <h3 className="text-xl font-bold text-foreground">
                    {loading ? '...' : `$${totalBalance.toFixed(2)}`}
                  </h3>
                </div>
              </div>
              {loading ? (
                <p className="text-xs text-muted-foreground">Loading accounts...</p>
              ) : accounts.length > 0 ? (
                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                  {accounts.map(account => (
                    <Link key={account.id} href={`/dashboard/transactions?accountId=${account.id}`}>
                      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-elevated transition-colors">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: account.color || '#3b82f6' }}
                          />
                          <p className="text-xs font-medium text-foreground truncate">
                            {account.name}
                            {account.accountNumberLast4 && (
                              <span className="text-muted-foreground ml-2">
                                {account.accountNumberLast4}
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="text-xs font-semibold text-foreground shrink-0 ml-2">
                          ${account.currentBalance.toFixed(2)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No accounts yet</p>
              )}
            </Card>

            {/* Credit Utilization Widget - Conditional */}
            <CreditUtilizationWidget />

            {/* Budget Surplus Card */}
            <BudgetSurplusCard />

            {/* Debt Countdown Card */}
            <Card className="border bg-card rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
              <DebtCountdownCard />
            </Card>
          </div>
        </section>

        {/* Add Transaction Button */}
        <section className="mb-12">
          <Link href="/dashboard/transactions/new" className="block">
            <Button className="w-full h-16 text-lg font-medium rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90" size="lg">
              <Plus className="mr-2 w-5 h-5" />
              Add Transaction
            </Button>
          </Link>
        </section>

        {/* Bills Widget */}
        <section className="mb-12">
          <BillsWidget />
        </section>

        {/* Recent Transactions */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Recent Transactions</h2>
            <Link href="/dashboard/transactions">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">View All</Button>
            </Link>
          </div>
          <RecentTransactions />
        </section>
      </div>
    </div>
  );
}
