'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

interface TopMerchant {
  merchant: string;
  amount: number;
  transactionCount: number;
}

interface SpendingSummaryData {
  period: string;
  totalIncome: number;
  totalExpense: number;
  totalTransfer: number;
  netAmount: number;
  byCategory: CategoryBreakdown[];
  topMerchants: TopMerchant[];
}

interface SpendingSummaryProps {
  period?: 'weekly' | 'monthly';
}

export function SpendingSummary({ period = 'monthly' }: SpendingSummaryProps) {
  const [summary, setSummary] = useState<SpendingSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [displayPeriod, setDisplayPeriod] = useState<'weekly' | 'monthly'>(period);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const dateStr = currentDate.toISOString().split('T')[0];
      const response = await fetch(`/api/spending-summary?period=${displayPeriod}&date=${dateStr}`, { credentials: 'include' });

      if (!response.ok) throw new Error('Failed to fetch summary');

      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Error fetching spending summary:', error);
    } finally {
      setLoading(false);
    }
  }, [currentDate, displayPeriod]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handlePrevious = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (displayPeriod === 'weekly') {
        newDate.setDate(newDate.getDate() - 7);
      } else {
        newDate.setMonth(newDate.getMonth() - 1);
      }
      return newDate;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (displayPeriod === 'weekly') {
        newDate.setDate(newDate.getDate() + 7);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  if (loading) {
    return (
      <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
        <CardHeader>
          <CardTitle className="text-white">Spending Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-400">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white">{summary.period}</CardTitle>
            <CardDescription>Spending Overview</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisplayPeriod(displayPeriod === 'weekly' ? 'monthly' : 'weekly')}
              className="text-xs bg-[#242424] border-[#3a3a3a] text-gray-300 hover:bg-[#2a2a2a]"
            >
              {displayPeriod === 'weekly' ? 'Monthly' : 'Weekly'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            className="bg-[#242424] border-[#3a3a3a] text-gray-300 hover:bg-[#2a2a2a]"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="text-xs bg-[#242424] border-[#3a3a3a] text-gray-300 hover:bg-[#2a2a2a]"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            className="bg-[#242424] border-[#3a3a3a] text-gray-300 hover:bg-[#2a2a2a]"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Income */}
          <div className="bg-[#242424] rounded-lg p-3 border border-[#2a2a2a]">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Income</p>
                <p className="text-lg font-bold text-emerald-400">
                  ${summary.totalIncome.toFixed(2)}
                </p>
              </div>
              <TrendingUp className="w-5 h-5 text-emerald-400 opacity-50" />
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-[#242424] rounded-lg p-3 border border-[#2a2a2a]">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Expenses</p>
                <p className="text-lg font-bold text-red-400">
                  ${summary.totalExpense.toFixed(2)}
                </p>
              </div>
              <TrendingDown className="w-5 h-5 text-red-400 opacity-50" />
            </div>
          </div>

          {/* Net */}
          <div className="bg-[#242424] rounded-lg p-3 border border-[#2a2a2a]">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Net</p>
                <p className={`text-lg font-bold ${summary.netAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ${summary.netAmount.toFixed(2)}
                </p>
              </div>
              <Wallet className="w-5 h-5 text-blue-400 opacity-50" />
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        {summary.byCategory.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white">Spending by Category</h3>
            <div className="space-y-2">
              {summary.byCategory.slice(0, 5).map((category) => (
                <div key={category.categoryId} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">{category.categoryName}</span>
                    <span className="text-sm font-medium text-white">
                      ${category.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Progress value={category.percentage} className="h-1.5 flex-1 bg-[#242424]" />
                    <span className="text-xs text-gray-500 ml-2 w-8 text-right">
                      {category.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Merchants */}
        {summary.topMerchants.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white">Top Merchants</h3>
            <div className="space-y-2">
              {summary.topMerchants.map((merchant, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-[#242424] p-2 rounded border border-[#2a2a2a] text-sm"
                >
                  <div className="flex-1">
                    <p className="text-gray-300 truncate">{merchant.merchant}</p>
                    <p className="text-xs text-gray-500">
                      {merchant.transactionCount} transaction{merchant.transactionCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="text-gray-300 font-medium">
                    ${merchant.amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
