'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';

interface Split {
  id: string;
  categoryId: string;
  amount: number;
  percentage: number | null;
  isPercentage: boolean;
  description: string | null;
  sortOrder: number;
}

interface SplitsListProps {
  transactionId: string;
}

export function SplitsList({ transactionId }: SplitsListProps) {
  const [splits, setSplits] = useState<Split[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSplits = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/transactions/${transactionId}/splits`, { credentials: 'include' });
        if (!response.ok) {
          throw new Error('Failed to fetch splits');
        }
        const data = await response.json();
        setSplits(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchSplits();
  }, [transactionId]);

  if (loading) {
    return (
      <Card className="border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="text-[#9ca3af]">Loading splits...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-[#f87171]/20 bg-[#f87171]/10 p-6">
        <p className="text-[#f87171]">
          {error}
        </p>
      </Card>
    );
  }

  if (splits.length === 0) {
    return null;
  }

  const totalAmount = splits.reduce((sum, split) => sum + split.amount, 0);

  return (
    <Card className="border-[#2a2a2a] bg-[#1a1a1a] p-6">
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Split Details ({splits.length})</h2>

        <div className="space-y-3">
          {splits.map((split, index) => (
            <div key={split.id} className="flex items-center justify-between p-3 rounded-lg bg-[#242424]">
              <div className="flex-1">
                <p className="text-sm text-[#6b7280] uppercase tracking-wide">
                  Split {index + 1}
                </p>
                {split.description && (
                  <p className="text-[#9ca3af] text-sm mt-1">{split.description}</p>
                )}
              </div>
              <div className="text-right">
                <div className="text-[#10b981] font-semibold">
                  ${split.amount.toFixed(2)}
                </div>
                {split.isPercentage && (
                  <p className="text-[#9ca3af] text-sm mt-1">
                    {split.percentage?.toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[#2a2a2a] pt-4 flex items-center justify-between">
          <p className="text-[#9ca3af]">Total</p>
          <p className="text-lg font-bold text-white">
            ${totalAmount.toFixed(2)}
          </p>
        </div>
      </div>
    </Card>
  );
}
