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
import { ExportButton } from '@/components/reports/export-button';
import { BarChart } from '@/components/charts';
import { AlertCircle, Calendar, DollarSign, TrendingUp, CheckCircle2 } from 'lucide-react';

interface QuarterlyReport {
  year: number;
  quarter: number;
  totalSales: number;
  totalTax: number;
  taxRate: number;
  dueDate: string;
  submittedDate?: string;
  status: 'not_due' | 'pending' | 'submitted' | 'accepted' | 'rejected';
  balanceDue: number;
}

interface SalesTaxSummary {
  year: number;
  totalSales: number;
  totalTax: number;
  totalDue: number;
  quarters: QuarterlyReport[];
}

/**
 * Sales Tax Dashboard Page
 * Quarterly sales tax reporting and filing status tracking
 */
export default function SalesTaxPage() {
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [data, setData] = useState<SalesTaxSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSalesTaxData();
  }, [year]);

  const fetchSalesTaxData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/sales-tax/quarterly?year=${year}`);

      if (!response.ok) {
        throw new Error('Failed to load sales tax data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Failed to load sales tax data. Please try again.');
      console.error('Error fetching sales tax data:', err);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'submitted':
        return <Calendar className="w-4 h-4 text-blue-400" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'rejected':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'text-emerald-400';
      case 'submitted':
        return 'text-blue-400';
      case 'pending':
        return 'text-amber-400';
      case 'rejected':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === 'accepted' || status === 'submitted') return false;
    const daysUntil = getDaysUntilDue(dueDate);
    return daysUntil < 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading sales tax information...</p>
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
          <Button onClick={fetchSalesTaxData}>Try Again</Button>
        </div>
      </div>
    );
  }

  // Check if there's any sales tax data for the selected year
  const hasData = data.quarters && data.quarters.length > 0;

  const chartData = data.quarters.map((q) => ({
    name: `Q${q.quarter}`,
    sales: q.totalSales,
    tax: q.totalTax,
  }));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Sales Tax Dashboard</h1>
          <p className="text-gray-400 mt-1">Track quarterly filings and prepare reports</p>
        </div>
        <div className="flex gap-2 flex-col md:flex-row">
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
          {data && (
            <ExportButton
              data={data}
              reportName="Sales_Tax_Report"
              summary={{
                year,
                totalSales: data.totalSales,
                totalTax: data.totalTax,
                totalDue: data.totalDue,
              }}
            />
          )}
        </div>
      </div>

      {/* No Data State */}
      {!hasData && (
        <Card className="text-center py-12">
          <CardContent>
            <DollarSign className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Sales Tax Data Available</h3>
            <p className="text-gray-400 mb-4">
              There are no sales transactions from business accounts for {year}.
            </p>
            <p className="text-sm text-gray-500 mb-2">
              To track sales tax:
            </p>
            <ul className="text-sm text-gray-500 text-left max-w-md mx-auto space-y-1">
              <li>1. Mark an account as a "Business Account" in the Accounts page</li>
              <li>2. Create income transactions in that business account</li>
              <li>3. Sales tax will be automatically calculated and tracked</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      {hasData && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-400">
              ${data.totalSales.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Sales Tax
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-400">
              ${data.totalTax.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Total Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-400">
              ${data.totalDue.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Effective Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-400">
              {data.totalSales > 0
                ? ((data.totalTax / data.totalSales) * 100).toFixed(2)
                : '0.00'}
              %
            </p>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Sales vs Tax Chart */}
      {hasData && (
      <BarChart
        title="Quarterly Sales & Tax"
        description={`Sales and tax collected by quarter for ${year}`}
        data={chartData}
        bars={[
          { dataKey: 'sales', fill: '#3b82f6', name: 'Sales' },
          { dataKey: 'tax', fill: '#10b981', name: 'Tax' },
        ]}
      />
      )}

      {/* Quarterly Filing Status */}
      {hasData && (
      <Card>
        <CardHeader>
          <CardTitle>Quarterly Filing Status</CardTitle>
          <CardDescription>Track filing status for each quarter</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.quarters.map((quarter) => {
              const daysUntil = getDaysUntilDue(quarter.dueDate);
              const overdue = isOverdue(quarter.dueDate, quarter.status);

              return (
                <div
                  key={quarter.quarter}
                  className="border border-border rounded-lg p-4 hover:border-border transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(quarter.status)}
                      <div>
                        <p className="text-white font-semibold">Q{quarter.quarter} {year}</p>
                        <p className={`text-sm ${getStatusColor(quarter.status)}`}>
                          {quarter.status.charAt(0).toUpperCase() +
                            quarter.status.slice(1)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold">
                        ${quarter.totalTax.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Tax collected
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm mb-3 pt-3 border-t border-border">
                    <div>
                      <p className="text-gray-500">Sales</p>
                      <p className="text-white font-medium">
                        ${quarter.totalSales.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Tax Rate</p>
                      <p className="text-white font-medium">
                        {(quarter.taxRate * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Due</p>
                      <p
                        className={`font-medium ${
                          overdue ? 'text-red-400' : 'text-white'
                        }`}
                      >
                        {quarter.dueDate}
                      </p>
                    </div>
                  </div>

                  {quarter.status !== 'accepted' && (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        {overdue && (
                          <span className="flex items-center gap-1 text-xs text-red-400">
                            <AlertCircle className="w-3 h-3" />
                            {Math.abs(daysUntil)} days overdue
                          </span>
                        )}
                        {!overdue && daysUntil > 0 && (
                          <span className="text-xs text-amber-400">
                            {daysUntil} days until due
                          </span>
                        )}
                      </div>
                      <Button variant="outline" size="sm">
                        Mark Filed
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Filing Deadlines */}
      {hasData && (
      <Card>
        <CardHeader>
          <CardTitle>Important Dates</CardTitle>
          <CardDescription>
            Keep track of your quarterly filing deadlines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.quarters.map((quarter) => (
              <div
                key={quarter.quarter}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-white font-medium">
                    Q{quarter.quarter} {year} Filing Due
                  </span>
                </div>
                <span className="text-gray-400 text-sm">{quarter.dueDate}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Tax Compliance Tips */}
      {hasData && (
      <Card className="bg-blue-950/30 border-blue-700/50">
        <CardHeader>
          <CardTitle className="text-blue-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Sales Tax Compliance Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-100">
          <p>✓ Keep all sales invoices and receipts organized</p>
          <p>✓ Track sales by tax jurisdiction/rate</p>
          <p>✓ File quarterly returns by the due date</p>
          <p>✓ Pay taxes withheld from sales</p>
          <p>✓ Maintain detailed records for at least 3-4 years</p>
          <p>✓ Report any sales tax exemptions correctly</p>
          <p>✓ Consider sales tax software for accurate tracking</p>
        </CardContent>
      </Card>
      )}
      </div>
    </div>
  );
}
