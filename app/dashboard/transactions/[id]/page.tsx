'use client';

import { useRouter } from 'next/navigation';
import { TransactionDetails } from '@/components/transactions/transaction-details';

interface TransactionPageProps {
  params: {
    id: string;
  };
}

export default function TransactionPage({ params }: TransactionPageProps) {
  const router = useRouter();

  const handleDelete = () => {
    router.push('/dashboard/transactions');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-2xl mx-auto p-6">
        <TransactionDetails transactionId={params.id} onDelete={handleDelete} />
      </div>
    </div>
  );
}
