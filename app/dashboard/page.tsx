import { UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, TrendingUp, DollarSign, PieChart } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-elevated/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">UnifiedLedger</h1>
            <p className="text-sm text-muted-foreground">Personal Finance Management</p>
          </div>
          <UserButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <section className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/transactions/new">
              <Button className="w-full h-16 text-lg" size="lg">
                <Plus className="mr-2" />
                Add Transaction
              </Button>
            </Link>
            <Link href="/dashboard/bills">
              <Button variant="outline" className="w-full h-16 text-lg" size="lg">
                <DollarSign className="mr-2" />
                Manage Bills
              </Button>
            </Link>
          </div>
        </section>

        {/* Overview Cards */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Quick Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Balance Card */}
            <Card className="p-6 border-border bg-elevated">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
                  <h3 className="text-3xl font-bold text-foreground">$0.00</h3>
                  <p className="text-xs text-muted-foreground mt-2">Across all accounts</p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </Card>

            {/* Monthly Spending Card */}
            <Card className="p-6 border-border bg-elevated">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">This Month</p>
                  <h3 className="text-3xl font-bold text-foreground">$0.00</h3>
                  <p className="text-xs text-muted-foreground mt-2">Total spending</p>
                </div>
                <div className="p-3 bg-red-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </Card>

            {/* Budget Status Card */}
            <Card className="p-6 border-border bg-elevated">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Budget Status</p>
                  <h3 className="text-3xl font-bold text-foreground">—</h3>
                  <p className="text-xs text-muted-foreground mt-2">Set up your budget</p>
                </div>
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <PieChart className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Recent Transactions */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Recent Transactions</h2>
            <Link href="/dashboard/transactions">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
          <Card className="p-6 border-border bg-elevated text-center py-12">
            <p className="text-muted-foreground">No transactions yet. Get started by adding your first transaction!</p>
          </Card>
        </section>
      </main>
    </div>
  );
}
