'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BillForm } from '@/components/bills/bill-form';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import type { BillTemplateUpsertPayload } from '@/components/bills/bill-form';

export default function NewBillPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { fetchWithHousehold } = useHouseholdFetch();
  const { selectedHouseholdId } = useHousehold();

  const handleSubmit = async (data: BillTemplateUpsertPayload, saveMode: 'save' | 'saveAndAdd' = 'save') => {
    if (!selectedHouseholdId) {
      toast.error('Please select a household first');
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetchWithHousehold('/api/bills/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create bill');
      }

      await response.json();

      // Show appropriate toast message
      if (saveMode === 'saveAndAdd') {
        toast.success(`Bill "${data.name}" saved successfully!`);
        // Stay on the page for adding another bill
      } else {
        toast.success('Bill created successfully');
        router.push('/dashboard/bills');
      }
    } catch (error) {
      console.error('Error creating bill:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create bill');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
        <Link
          href="/dashboard/bills"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Create New Bill</h1>
          <p className="text-muted-foreground mt-1">
            Set up a recurring bill and automatically track payments
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle>Bill Details</CardTitle>
          <CardDescription className="text-gray-500">
            Enter the bill information. The system will automatically match and track payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BillForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
