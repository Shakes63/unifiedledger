'use client';

import { useEffect, useMemo } from 'react';
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
import { PaycheckBalanceWidget } from '@/components/dashboard/paycheck-balance-widget';
import { betterAuthClient } from '@/lib/better-auth-client';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { data: session, isPending: _isPending } = betterAuthClient.useSession();

  const greeting = useMemo(() => getGreeting(), []);
  const firstName = session?.user?.name?.split(' ')[0];

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const response = await fetch('/api/auth/init', { credentials: 'include', method: 'POST' });
        if (response.ok) {
          console.log('User initialized');
        }
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    if (session) {
      initializeUser();
    }
  }, [session]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header: Greeting + Quick Action */}
        <section className="mb-6 dashboard-fade-in">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
                {greeting}{firstName ? `, ${firstName}` : ''}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                Here&apos;s your financial overview
              </p>
            </div>
            <Link href="/dashboard/transactions/new" className="shrink-0">
              <Button
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}
                className="hover:opacity-90 rounded-full px-5 h-10 text-sm font-medium shadow-sm"
              >
                <Plus className="mr-1.5 w-4 h-4" />
                <span className="hidden sm:inline">New Transaction</span>
                <span className="sm:hidden">New</span>
              </Button>
            </Link>
          </div>
        </section>

        {/* Financial Overview */}
        <section className="mb-6">
          <CompactStatsBar />
        </section>

        {/* Main Content Grid */}
        <section className="mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Primary Column: Bills + Transactions */}
            <div className="lg:col-span-2 space-y-5">
              <EnhancedBillsWidget />

              <div
                className="rounded-xl border p-4"
                style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', borderLeftWidth: 4, borderLeftColor: 'var(--color-transfer)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>
                    Recent Transactions
                  </h2>
                </div>
                <RecentTransactions />
              </div>
            </div>

            {/* Secondary Column: Next Payments + Category Breakdown */}
            <div className="lg:col-span-1 space-y-5">
              <NextPaymentDueWidget />
              <BillsByClassificationWidget />
            </div>
          </div>
        </section>

        {/* Budget Details */}
        <CollapsibleSection
          title="Budget Details"
          storageKey="dashboard-budget-details"
          defaultExpanded={false}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-1">
              <PaycheckBalanceWidget />
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
              <BudgetSummaryWidget />
              <BudgetSurplusCard />
            </div>
          </div>
        </CollapsibleSection>

        {/* Debt & Credit */}
        <CollapsibleSection
          title="Debt & Credit"
          storageKey="dashboard-debt-credit"
          defaultExpanded={false}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CreditUtilizationWidget />
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
            >
              <DebtCountdownCard />
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
