import React from 'react';
import { BillDetails } from '@/components/bills/bill-details';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BillDetailsPage({ params }: PageProps) {
  const resolvedParams = await params;
  const billId = resolvedParams.id;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        <BillDetails billId={billId} />
      </div>
    </div>
  );
}
