'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, TrendingUp, DollarSign, PieChart } from 'lucide-react';
import Link from 'next/link';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { BillsWidget } from '@/components/dashboard/bills-widget';
import { useAuth } from '@clerk/nextjs';
import Decimal from 'decimal.js';

interface Account {
  id: string;
  name: string;
  currentBalance: number;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  date: string;
}

export default function DashboardPage() {
  const { isLoaded } = useAuth();
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [monthlySpending, setMonthlySpending] = useState<number>(0);
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
          const accounts: Account[] = await accountsResponse.json();
          const total = accounts.reduce((sum, account) => {
            return new Decimal(sum).plus(new Decimal(account.currentBalance || 0)).toNumber();
          }, 0);
          setTotalBalance(total);
        }

        // Fetch transactions to calculate monthly spending
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const txResponse = await fetch('/api/transactions?limit=1000');
        if (txResponse.ok) {
          const transactions: Transaction[] = await txResponse.json();

          // Filter for current month expenses
          const monthlyExpenses = transactions.filter(tx => {
            const txDate = new Date(tx.date);
            return tx.type === 'expense' &&
                   txDate >= firstDayOfMonth &&
                   txDate <= lastDayOfMonth;
          });

          const total = monthlyExpenses.reduce((sum, tx) => {
            return new Decimal(sum).plus(new Decimal(tx.amount || 0)).toNumber();
          }, 0);
          setMonthlySpending(total);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Overview Cards */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-6 text-white">Quick Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Balance Card */}
            <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Total Balance</p>
                  <h3 className="text-3xl font-bold text-white">
                    {loading ? '...' : `$${totalBalance.toFixed(2)}`}
                  </h3>
                  <p className="text-xs text-gray-500 mt-3">Across all accounts</p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </Card>

            {/* Monthly Spending Card */}
            <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-2">This Month</p>
                  <h3 className="text-3xl font-bold text-white">
                    {loading ? '...' : `$${monthlySpending.toFixed(2)}`}
                  </h3>
                  <p className="text-xs text-gray-500 mt-3">Total spending</p>
                </div>
                <div className="p-3 bg-red-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-red-400" />
                </div>
              </div>
            </Card>

            {/* Budget Status Card */}
            <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Budget Status</p>
                  <h3 className="text-3xl font-bold text-white">—</h3>
                  <p className="text-xs text-gray-500 mt-3">Set up your budget</p>
                </div>
                <div className="p-3 bg-emerald-500/20 rounded-lg">
                  <PieChart className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Add Transaction Button */}
        <section className="mb-12">
          <Link href="/dashboard/transactions/new" className="block">
            <Button className="w-full h-16 text-lg bg-white text-black hover:bg-gray-100 font-medium rounded-lg" size="lg">
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
            <h2 className="text-xl font-bold text-white">Recent Transactions</h2>
            <Link href="/dashboard/transactions">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">View All</Button>
            </Link>
          </div>
          <RecentTransactions />
        </section>
      </div>
    </div>
  );
}
