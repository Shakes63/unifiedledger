'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart } from '@/components/charts';
import { FileText, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';

interface TaxSummary {
  year: number;
  totalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    formType: string;
    lineNumber?: string;
    totalAmount: number;
    transactionCount: number;
    isDeductible: boolean;
  }>;
}

interface TaxData {
  summary: TaxSummary;
  estimates: {
    estimatedQuarterlyPayment: number;
    estimatedAnnualTax: number;
  };
}

/**
 * Tax Dashboard Page
 * Comprehensive tax reporting and deduction tracking
 */
export default function TaxPage() {
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [data, setData] = useState<TaxData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTaxData();
  }, [year]);

  const fetchTaxData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/tax/summary?year=${year}`);

      if (!response.ok) {
        throw new Error('Failed to load tax data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Failed to load tax data. Please try again.');
      console.error('Error fetching tax data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const options = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      options.push(i);
    }
    return options;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading tax information...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-400 font-medium mb-2">Error</p>
          <p className="text-gray-400 mb-4">{error || 'Unknown error'}</p>
          <Button onClick={fetchTaxData}>Try Again</Button>
        </div>
      </div>
    );
  }

  const deductionData = data.summary.byCategory
    .filter((c) => c.isDeductible)
    .map((c) => ({
      name: c.categoryName,
      amount: Math.abs(c.totalAmount),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Tax Dashboard</h1>
          <p className="text-gray-400 mt-1">Track deductions and prepare for tax season</p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {getYearOptions().map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-400">
              ${data.summary.totalIncome.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Deductions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-400">
              ${data.summary.totalDeductions.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Taxable Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-400">
              ${data.summary.taxableIncome.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Est. Quarterly Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-400">
              ${data.estimates.estimatedQuarterlyPayment.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Annual: ${data.estimates.estimatedAnnualTax.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Deductions Chart */}
      {deductionData.length > 0 && (
        <BarChart
          title="Top Tax Deductions"
          description={`Largest deduction categories for ${year}`}
          data={deductionData}
          bars={[{ dataKey: 'amount', fill: '#3b82f6', name: 'Amount' }]}
          layout="vertical"
        />
      )}

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Form Type */}
        <Card>
          <CardHeader>
            <CardTitle>Deductions by Form Type</CardTitle>
            <CardDescription>Organized by tax form for easy reference</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from(
                new Set(data.summary.byCategory.filter((c) => c.isDeductible).map((c) => c.formType))
              ).map((formType) => {
                const items = data.summary.byCategory.filter(
                  (c) => c.formType === formType && c.isDeductible
                );
                const total = items.reduce((sum, item) => sum + item.totalAmount, 0);

                return (
                  <div key={formType} className="border-l-2 border-blue-400 pl-4">
                    <p className="text-white font-semibold">
                      {formType.replace(/_/g, ' ').toUpperCase()}
                    </p>
                    <p className="text-2xl font-bold text-blue-400">
                      ${total.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{items.length} categories</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tax Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Year Summary</CardTitle>
            <CardDescription>Calculated from tracked transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-[#2a2a2a]">
                <span className="text-gray-400">Total Income:</span>
                <span className="text-white font-semibold">
                  ${data.summary.totalIncome.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-[#2a2a2a]">
                <span className="text-gray-400">Total Deductions:</span>
                <span className="text-white font-semibold">
                  -${data.summary.totalDeductions.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-[#2a2a2a]">
                <span className="text-gray-400">Taxable Income:</span>
                <span className="text-yellow-400 font-bold text-lg">
                  ${data.summary.taxableIncome.toFixed(2)}
                </span>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-3 mt-4">
                <p className="text-xs text-gray-500 mb-2">ESTIMATED TAX PAYMENT</p>
                <p className="text-2xl font-bold text-amber-400">
                  ${data.estimates.estimatedQuarterlyPayment.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Per quarter (est. annual: ${data.estimates.estimatedAnnualTax.toFixed(2)})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Deductions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Deduction Categories</CardTitle>
          <CardDescription>Complete list of tracked tax deductions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left py-3 text-gray-400 font-medium">Category</th>
                  <th className="text-left py-3 text-gray-400 font-medium">Form</th>
                  <th className="text-right py-3 text-gray-400 font-medium">Amount</th>
                  <th className="text-right py-3 text-gray-400 font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.summary.byCategory
                  .filter((c) => c.isDeductible)
                  .sort((a, b) => b.totalAmount - a.totalAmount)
                  .map((category) => (
                    <tr key={category.categoryId} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                      <td className="py-3 text-white">{category.categoryName}</td>
                      <td className="py-3 text-gray-400 text-xs">
                        {category.formType.replace(/_/g, ' ').toUpperCase()}
                      </td>
                      <td className="py-3 text-right text-white font-medium">
                        ${category.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3 text-right text-gray-400">
                        {category.transactionCount}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Helpful Tips */}
      <Card className="bg-amber-950/30 border-amber-700/50">
        <CardHeader>
          <CardTitle className="text-amber-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Tax Preparation Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-amber-100">
          <p>
            ✓ Keep detailed records of all transactions and receipts for audit purposes
          </p>
          <p>
            ✓ Track business expenses separately from personal expenses
          </p>
          <p>
            ✓ Review your category mappings annually to ensure accuracy
          </p>
          <p>
            ✓ Consider consulting a tax professional for complex situations
          </p>
          <p>
            ✓ Make quarterly estimated tax payments to avoid penalties
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
