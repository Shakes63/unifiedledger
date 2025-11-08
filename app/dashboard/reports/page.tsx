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
import {
  LineChart,
  BarChart,
  PieChart,
  AreaChart,
  ComposedChart,
  ProgressChart,
} from '@/components/charts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportButton } from '@/components/reports/export-button';

type Period = 'month' | 'year' | '12months';

interface ReportData {
  incomeVsExpenses: any;
  categoryBreakdown: any;
  cashFlow: any;
  netWorth: any;
  budgetVsActual: any;
  merchantAnalysis: any;
}

const COLOR_PALETTE = {
  income: '#10b981',
  expense: '#f87171',
  transfer: '#60a5fa',
  warning: '#fbbf24',
  primary: '#3b82f6',
};

/**
 * Reports Dashboard Page
 * Comprehensive financial reporting with multiple visualization types
 */
export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('12months');
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, [period]);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [ivE, cb, cf, nw, bva, ma] = await Promise.all([
        fetch(`/api/reports/income-vs-expenses?period=${period}`).then((r) => r.json()),
        fetch(`/api/reports/category-breakdown?period=${period}`).then((r) => r.json()),
        fetch(`/api/reports/cash-flow?period=${period}`).then((r) => r.json()),
        fetch(`/api/reports/net-worth?period=${period}`).then((r) => r.json()),
        fetch(`/api/reports/budget-vs-actual?period=${period}`).then((r) => r.json()),
        fetch(`/api/reports/merchant-analysis?period=${period}`).then((r) => r.json()),
      ]);

      setData({
        incomeVsExpenses: ivE,
        categoryBreakdown: cb,
        cashFlow: cf,
        netWorth: nw,
        budgetVsActual: bva,
        merchantAnalysis: ma,
      });
    } catch (err) {
      setError('Failed to load reports. Please try again.');
      console.error('Error fetching reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-400 font-medium mb-2">Error Loading Reports</p>
          <p className="text-gray-400 mb-4">{error || 'Unknown error'}</p>
          <Button onClick={fetchReports}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Financial Reports</h1>
          <p className="text-gray-400 mt-1">Comprehensive analysis of your finances</p>
        </div>
        <div className="flex gap-2 flex-col md:flex-row">
          <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="12months">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
          {data && (
            <ExportButton
              data={data}
              reportName="Financial_Report"
              summary={{
                period,
                generated: new Date().toLocaleDateString(),
              }}
            />
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-400">
              ${data.incomeVsExpenses?.data
                ?.reduce((sum: number, item: any) => sum + item.income, 0)
                .toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">
              ${data.incomeVsExpenses?.data
                ?.reduce((sum: number, item: any) => sum + item.expenses, 0)
                .toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Net Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-400">
              ${data.incomeVsExpenses?.data
                ?.reduce((sum: number, item: any) => sum + item.net, 0)
                .toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Net Worth</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${data.netWorth?.currentNetWorth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${data.netWorth?.currentNetWorth.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses */}
        <LineChart
          title="Income vs Expenses"
          description={`Trend comparison for ${period === '12months' ? 'last 12 months' : 'period'}`}
          data={data.incomeVsExpenses?.data || []}
          lines={[
            { dataKey: 'income', stroke: COLOR_PALETTE.income, name: 'Income' },
            { dataKey: 'expenses', stroke: COLOR_PALETTE.expense, name: 'Expenses' },
          ]}
        />

        {/* Category Breakdown */}
        <PieChart
          title="Spending by Category"
          description={`Distribution of ${period === '12months' ? 'annual' : 'period'} expenses`}
          data={data.categoryBreakdown?.data || []}
          colors={[
            COLOR_PALETTE.primary,
            COLOR_PALETTE.income,
            COLOR_PALETTE.expense,
            COLOR_PALETTE.transfer,
            COLOR_PALETTE.warning,
            '#8b5cf6',
            '#ec4899',
            '#14b8a6',
          ]}
        />

        {/* Cash Flow */}
        <AreaChart
          title="Cash Flow Analysis"
          description={`Inflows and outflows ${period === '12months' ? 'over 12 months' : 'for period'}`}
          data={data.cashFlow?.data || []}
          areas={[
            {
              dataKey: 'inflows',
              fill: COLOR_PALETTE.income,
              stroke: COLOR_PALETTE.income,
              name: 'Inflows',
            },
            {
              dataKey: 'outflows',
              fill: COLOR_PALETTE.expense,
              stroke: COLOR_PALETTE.expense,
              name: 'Outflows',
            },
          ]}
        />

        {/* Net Worth Trend */}
        <LineChart
          title="Net Worth Trend"
          description={`Historical net worth ${period === '12months' ? 'over 12 months' : 'for period'}`}
          data={data.netWorth?.history || []}
          lines={[
            { dataKey: 'netWorth', stroke: COLOR_PALETTE.primary, name: 'Net Worth' },
          ]}
          xAxisLabel={period === '12months' ? 'Month' : 'Week'}
          yAxisLabel="Amount ($)"
        />
      </div>

      {/* Budget vs Actual */}
      <BarChart
        title="Budget vs Actual Spending"
        description="Compare your budgets against actual spending"
        data={data.budgetVsActual?.data || []}
        bars={[
          { dataKey: 'budget', fill: COLOR_PALETTE.primary, name: 'Budget' },
          { dataKey: 'actual', fill: COLOR_PALETTE.expense, name: 'Actual' },
        ]}
        layout="vertical"
      />

      {/* Account Breakdown & Top Merchants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Net Worth Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Account Breakdown</CardTitle>
            <CardDescription>Current balance by account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.netWorth?.accountBreakdown?.map((account: any) => (
                <div key={account.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: account.color || COLOR_PALETTE.primary }}
                    />
                    <div>
                      <p className="text-white font-medium">{account.name}</p>
                      <p className="text-xs text-gray-500">{account.type}</p>
                    </div>
                  </div>
                  <p className="text-white font-medium">${account.balance.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Merchants */}
        <Card>
          <CardHeader>
            <CardTitle>Top Merchants</CardTitle>
            <CardDescription>Your biggest spending categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.merchantAnalysis?.data?.slice(0, 5).map((merchant: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm truncate">{merchant.name}</p>
                    <p className="text-xs text-gray-500">{merchant.count} transactions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">${merchant.amount.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{merchant.percentageOfTotal.toFixed(0)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Merchants Bar Chart */}
      <BarChart
        title="Merchant Spending Distribution"
        description="Top 10 merchants by total spending"
        data={data.merchantAnalysis?.data?.slice(0, 10) || []}
        bars={[{ dataKey: 'amount', fill: COLOR_PALETTE.expense, name: 'Amount' }]}
        layout="vertical"
      />
    </div>
  );
}
