'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, TrendingUp, DollarSign, PieChart } from 'lucide-react';
import Link from 'next/link';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { BillsWidget } from '@/components/dashboard/bills-widget';
import { useAuth } from '@clerk/nextjs';

export default function DashboardPage() {
  const { isLoaded } = useAuth();

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
                  <h3 className="text-3xl font-bold text-white">$0.00</h3>
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
                  <h3 className="text-3xl font-bold text-white">$0.00</h3>
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
