import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TransactionForm } from '@/components/transactions/transaction-form';

export default function NewTransactionPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-elevated/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6">
              <Image
                src="/logo.png"
                alt="UnifiedLedger Logo"
                width={24}
                height={24}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Add Transaction</h1>
              <p className="text-sm text-muted-foreground">Track your income and expenses</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-6 border border-[#2a2a2a] bg-[#1a1a1a] rounded-xl">
          <TransactionForm />
        </Card>
      </main>
    </div>
  );
}
