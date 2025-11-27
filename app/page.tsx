import { redirect } from 'next/navigation';
import { auth } from '@/lib/better-auth';
import { headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { DollarSign, BarChart3, Target } from 'lucide-react';
import { isFirstUser } from '@/lib/auth/owner-helpers';

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Redirect authenticated users to dashboard
  if (session) {
    redirect('/dashboard');
  }

  // Check if this is first startup (no users exist)
  // If so, redirect to sign-up with firstSetup flag
  const firstUser = await isFirstUser();
  if (firstUser) {
    redirect('/sign-up?firstSetup=true');
  }

  // Landing page for unauthenticated users
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-elevated/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <Image
                src="/logo.png"
                alt="UnifiedLedger Logo"
                fill
                className="object-contain"
              />
            </div>
            <h1 className="text-xl font-bold text-foreground font-sans">Unified Ledger</h1>
          </div>
          <div className="flex gap-4">
            <Link
              href="/sign-in"
              className="px-4 py-2 text-foreground hover:text-foreground/80 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="px-4 py-2 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-5xl sm:text-6xl font-bold text-white mb-6">
          Take Control of Your Finances
        </h2>
        <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
          Track transactions, manage bills, set budgets, and achieve your financial goals—all in one beautiful app.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/sign-up"
            className="px-8 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-colors font-medium text-lg"
          >
            Start Free
          </Link>
          <Link
            href="/sign-in"
            className="px-8 py-3 border border-[#3a3a3a] text-white rounded-lg hover:bg-[#242424] transition-colors font-medium text-lg"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-[#0f0f0f] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-white mb-12 text-center">Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-blue-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Track Transactions</h4>
              <p className="text-gray-400">Easily log income and expenses with smart categorization</p>
            </div>
            <div className="p-6 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-emerald-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Budget Management</h4>
              <p className="text-gray-400">Set budgets and monitor spending across categories</p>
            </div>
            <div className="p-6 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-purple-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Financial Goals</h4>
              <p className="text-gray-400">Track savings goals and debt payoff progress</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2a2a2a] py-8 text-center text-gray-500">
        <p>&copy; 2024 Unified Ledger. All rights reserved.</p>
      </footer>
    </div>
  );
}
