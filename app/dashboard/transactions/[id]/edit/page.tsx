'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { TransactionForm } from '@/components/transactions/transaction-form';

interface EditTransactionPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EditTransactionPage({ params }: EditTransactionPageProps) {
  const router = useRouter();
  const resolvedParams = React.use(params);

  const handleEditSuccess = () => {
    router.push(`/dashboard/transactions/${resolvedParams.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/dashboard/transactions/${resolvedParams.id}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Transaction
            </Button>
          </Link>
        </div>

        <Card className="border-border bg-card p-6">
          <h1 className="text-2xl font-bold text-white mb-6">Edit Transaction</h1>
          <TransactionForm transactionId={resolvedParams.id} onEditSuccess={handleEditSuccess} />
        </Card>
      </div>
    </div>
  );
}
