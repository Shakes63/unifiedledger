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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/dashboard/transactions/${resolvedParams.id}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Transaction
            </Button>
          </Link>
        </div>

        <Card className="p-6" style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
          <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-foreground)' }}>Edit Transaction</h1>
          <TransactionForm transactionId={resolvedParams.id} onEditSuccess={handleEditSuccess} />
        </Card>
      </div>
    </div>
  );
}
