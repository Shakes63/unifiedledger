'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BillForm } from '@/components/bills/bill-form';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditBillPage({ params }: PageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [billData, setBillData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [billId, setBillId] = useState<string>('');

  useEffect(() => {
    const initPage = async () => {
      const resolvedParams = await params;
      setBillId(resolvedParams.id);

      // Fetch existing bill data
      try {
        const response = await fetch(`/api/bills/${resolvedParams.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch bill');
        }
        const data = await response.json();
        setBillData(data.bill);
      } catch (error) {
        console.error('Error fetching bill:', error);
        toast.error('Failed to load bill data');
        router.push('/dashboard/bills');
      } finally {
        setLoading(false);
      }
    };

    initPage();
  }, [params, router]);

  const handleSubmit = async (data: any) => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/bills/${billId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update bill');
      }

      const result = await response.json();
      toast.success('Bill updated successfully');
      router.push(`/dashboard/bills/${billId}`);
    } catch (error) {
      console.error('Error updating bill:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update bill');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push(`/dashboard/bills/${billId}`);
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/bills/${billId}`}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Edit Bill</h1>
            <p className="text-gray-400 mt-1">
              Update bill information and settings
            </p>
          </div>
        </div>

        {/* Form Card */}
        <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
          <CardHeader>
            <CardTitle>Bill Details</CardTitle>
            <CardDescription className="text-gray-500">
              Modify the bill information. Changes will apply to future instances.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BillForm
              bill={billData}
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
