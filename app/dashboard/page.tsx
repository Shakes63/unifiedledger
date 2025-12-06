'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { CompactStatsBar } from '@/components/dashboard/compact-stats-bar';
import { EnhancedBillsWidget } from '@/components/dashboard/enhanced-bills-widget';
import { CollapsibleSection } from '@/components/dashboard/collapsible-section';
import { DebtCountdownCard } from '@/components/dashboard/debt-countdown-card';
import { BudgetSurplusCard } from '@/components/dashboard/budget-surplus-card';
import { BudgetSummaryWidget } from '@/components/dashboard/budget-summary-widget';
import { CreditUtilizationWidget } from '@/components/debts/credit-utilization-widget';
import { NextPaymentDueWidget } from '@/components/dashboard/next-payment-due-widget';
import { BillsByClassificationWidget } from '@/components/dashboard/bills-by-classification-widget';
import { BudgetPeriodWidget } from '@/components/dashboard/budget-period-widget';
import { betterAuthClient } from '@/lib/better-auth-client';

export default function DashboardPage() {
  const { data: session, isPending } = betterAuthClient.useSession();

  useEffect(() => {
    // Initialize user on first load
    const initializeUser = async () => {
      try {
        const response = await fetch('/api/auth/init', { credentials: 'include', method: 'POST', });
        if (response.ok) {
          console.log('User initialized');
        }
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    if (!isPending && session) {
      initializeUser();
    }
  }, [isPending, session]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Compact Stats Bar */}
        <section className="mb-6">
          <CompactStatsBar />
        </section>

        {/* Add Transaction Button */}
        <section className="mb-8">
          <Link href="/dashboard/transactions/new" className="block">
            <Button className="w-full h-16 text-lg font-medium rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90" size="lg">
              <Plus className="mr-2 w-5 h-5" />
              Add Transaction
            </Button>
          </Link>
        </section>

        {/* Bills Section */}
        <section className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Enhanced Bills Widget - Takes 2 columns on large screens */}
            <div className="lg:col-span-2">
              <EnhancedBillsWidget />
            </div>
            
            {/* Sidebar widgets - stacked */}
            <div className="lg:col-span-1 space-y-6">
              {/* Budget Period Widget - shows when user has non-monthly budget cycle */}
              <BudgetPeriodWidget />
              <NextPaymentDueWidget />
              <BillsByClassificationWidget />
            </div>
          </div>
        </section>

        {/* Recent Transactions */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">Recent Transactions</h2>
            <Link href="/dashboard/transactions">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">View All</Button>
            </Link>
          </div>
          <RecentTransactions />
        </section>

        {/* Budget Details - Collapsible */}
        <CollapsibleSection
          title="Budget Details"
          storageKey="dashboard-budget-details"
          defaultExpanded={false}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BudgetSummaryWidget />
            <BudgetSurplusCard />
          </div>
        </CollapsibleSection>

        {/* Debt & Credit - Collapsible */}
        <CollapsibleSection
          title="Debt & Credit"
          storageKey="dashboard-debt-credit"
          defaultExpanded={false}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CreditUtilizationWidget />
            <div className="border bg-card rounded-xl overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
              <DebtCountdownCard />
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
