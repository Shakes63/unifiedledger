import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';

export default async function Home() {
  const { userId } = await auth();

  // Redirect authenticated users to dashboard
  if (userId) {
    redirect('/dashboard');
  }

  // Landing page for unauthenticated users
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-elevated/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center">
              <span className="text-white font-bold">UL</span>
            </div>
            <h1 className="text-xl font-bold text-foreground">UnifiedLedger</h1>
          </div>
          <div className="flex gap-4">
            <a
              href="/sign-in"
              className="px-4 py-2 text-foreground hover:text-foreground/80 transition-colors"
            >
              Sign In
            </a>
            <a
              href="/sign-up"
              className="px-4 py-2 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-5xl sm:text-6xl font-bold text-foreground mb-6">
          Take Control of Your Finances
        </h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Track transactions, manage bills, set budgets, and achieve your financial goals—all in one beautiful app.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/sign-up"
            className="px-8 py-3 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity font-medium text-lg"
          >
            Start Free
          </a>
          <a
            href="/sign-in"
            className="px-8 py-3 border border-foreground text-foreground rounded-lg hover:bg-elevated transition-colors font-medium text-lg"
          >
            Sign In
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-elevated/50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-foreground mb-12 text-center">Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-background rounded-lg border border-border">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">💰</span>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">Track Transactions</h4>
              <p className="text-muted-foreground">Easily log income and expenses with smart categorization</p>
            </div>
            <div className="p-6 bg-background rounded-lg border border-border">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">Budget Management</h4>
              <p className="text-muted-foreground">Set budgets and monitor spending across categories</p>
            </div>
            <div className="p-6 bg-background rounded-lg border border-border">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h4 className="text-lg font-semibold text-foreground mb-2">Financial Goals</h4>
              <p className="text-muted-foreground">Track savings goals and debt payoff progress</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-muted-foreground">
        <p>&copy; 2024 UnifiedLedger. All rights reserved.</p>
      </footer>
    </div>
  );
}
