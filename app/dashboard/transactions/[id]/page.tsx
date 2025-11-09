'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { TransactionDetails } from '@/components/transactions/transaction-details';

interface TransactionPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function TransactionPage({ params }: TransactionPageProps) {
  const router = useRouter();
  const resolvedParams = React.use(params);

  const handleDelete = () => {
    router.push('/dashboard/transactions');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-6">
        <TransactionDetails transactionId={resolvedParams.id} onDelete={handleDelete} />
      </div>
    </div>
  );
}
