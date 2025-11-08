'use client';

import { useEffect } from 'react';
import { UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, TrendingUp, DollarSign, PieChart, ArrowRightLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-elevated/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8">
              <Image
                src="/logo.png"
                alt="UnifiedLedger Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground font-sans">Unified Ledger</h1>
              <p className="text-sm text-muted-foreground">Personal Finance Management</p>
            </div>
          </div>
          <UserButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <section className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/dashboard/transactions/new">
              <Button className="w-full h-16 text-lg bg-white text-black hover:bg-gray-100 font-medium rounded-lg" size="lg">
                <Plus className="mr-2 w-5 h-5" />
                Add Transaction
              </Button>
            </Link>
            <Link href="/dashboard/transfers">
              <Button variant="outline" className="w-full h-16 text-lg bg-[#242424] text-white border-[#3a3a3a] hover:bg-[#2a2a2a] font-medium rounded-lg" size="lg">
                <ArrowRightLeft className="mr-2 w-5 h-5" />
                Transfer Money
              </Button>
            </Link>
            <Link href="/dashboard/bills">
              <Button variant="outline" className="w-full h-16 text-lg bg-[#242424] text-white border-[#3a3a3a] hover:bg-[#2a2a2a] font-medium rounded-lg" size="lg">
                <DollarSign className="mr-2 w-5 h-5" />
                Manage Bills
              </Button>
            </Link>
          </div>
        </section>

        {/* Overview Cards */}
        <section className="mb-12">
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
      </main>
    </div>
  );
}
