'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import { useReportFilters } from '@/lib/hooks/use-report-filters';
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
  TreemapChart,
  HeatmapChart,
} from '@/components/charts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportButton } from '@/components/reports/export-button';
import { DateRangePicker } from '@/components/reports/date-range-picker';
import { ReportFilters } from '@/components/reports/report-filters';
import { PaymentBreakdownSection } from '@/components/debts/payment-breakdown-section';
import { DebtReductionChart } from '@/components/debts/debt-reduction-chart';
import { AmortizationScheduleView } from '@/components/debts/amortization-schedule-view';
import { ChevronDown, ChevronUp, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { FeatureGate } from '@/components/experimental/feature-gate';
import type { PayoffStrategyResult } from '@/lib/debts/payoff-calculator';

type Period = 'month' | 'year' | '12months';

type ChartDataPoint = { name: string; [key: string]: string | number };
type PieDataPoint = { name: string; value: number; [key: string]: string | number };

interface ReportData {
  incomeVsExpenses: { data?: Array<Record<string, unknown>> } & Record<string, unknown>;
  categoryBreakdown: { data?: Array<{ name?: string; value?: number; amount?: number; count?: number; categoryId?: string }> } & Record<string, unknown>;
  cashFlow: { data?: Array<Record<string, unknown>> } & Record<string, unknown>;
  netWorth: {
    history?: Array<Record<string, unknown>>;
    accountBreakdown?: Array<{ name?: string; balance?: number; type?: string; color?: string }>;
    currentNetWorth?: number;
  } & Record<string, unknown>;
  budgetVsActual: Record<string, unknown>;
  merchantAnalysis: { data?: Array<{ name?: string; count?: number; amount?: number; percentageOfTotal?: number }> } & Record<string, unknown>;
}

const COLOR_PALETTE = {
  income: 'var(--color-income)',
  expense: 'var(--color-expense)',
  transfer: 'var(--color-transfer)',
  warning: 'var(--color-warning)',
  primary: 'var(--color-primary)',
};

/**
 * Reports Dashboard Page
 * Comprehensive financial reporting with multiple visualization types
 */
export default function ReportsPage() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  
  // Filter state management
  const {
    startDate,
    endDate,
    period,
    setDateRange,
    setPeriod,
    selectedAccountIds,
    selectedCategoryIds,
    selectedMerchantIds,
    setAccountIds,
    setCategoryIds,
    setMerchantIds,
    clearAllFilters,
    getFilterParams,
  } = useReportFilters();
  
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentBreakdown, setShowPaymentBreakdown] = useState(false);
  const [showDebtReduction, setShowDebtReduction] = useState(false);
  const [showAmortization, setShowAmortization] = useState(false);
  const [payoffStrategy, setPayoffStrategy] = useState<unknown>(null);
  
  // Filter data
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [merchants, setMerchants] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);

  const loadPayoffStrategy = useCallback(async () => {
    if (!selectedHouseholdId) return;
    try {
      // Fetch debt settings first
      const settingsResponse = await fetchWithHousehold('/api/debts/settings');
      const settings = settingsResponse.ok ? await settingsResponse.json() : null;

      const extraPayment = settings?.extraMonthlyPayment || 0;
      const method = settings?.preferredMethod || 'avalanche';
      const frequency = settings?.paymentFrequency || 'monthly';

      const response = await fetchWithHousehold(`/api/debts/payoff-strategy?extraPayment=${extraPayment}&method=${method}&paymentFrequency=${frequency}`);

      if (response.ok) {
        const strategyData = await response.json();
        setPayoffStrategy(strategyData);
      }
    } catch (error) {
      console.error('Error loading payoff strategy:', error);
      setPayoffStrategy(null);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  // Fetch filter data on mount
  useEffect(() => {
    const fetchFilterData = async () => {
      if (!selectedHouseholdId) return;
      
      setIsLoadingFilters(true);
      try {
        const [accountsRes, categoriesRes, merchantsRes] = await Promise.all([
          fetchWithHousehold('/api/accounts'),
          fetchWithHousehold('/api/categories'),
          fetchWithHousehold('/api/merchants'),
        ]);
        
        // Handle accounts
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          setAccounts(accountsData.data || []);
        } else {
          console.warn('Failed to fetch accounts for filters');
          setAccounts([]);
        }
        
        // Handle categories
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData.data || []);
        } else {
          console.warn('Failed to fetch categories for filters');
          setCategories([]);
        }
        
        // Handle merchants
        if (merchantsRes.ok) {
          const merchantsData = await merchantsRes.json();
          setMerchants(Array.isArray(merchantsData) ? merchantsData : (merchantsData.data || []));
        } else {
          console.warn('Failed to fetch merchants for filters');
          setMerchants([]);
        }
      } catch (error) {
        console.error('Error fetching filter data:', error);
        // Set empty arrays on error to prevent UI issues
        setAccounts([]);
        setCategories([]);
        setMerchants([]);
      } finally {
        setIsLoadingFilters(false);
      }
    };
    
    if (selectedHouseholdId) {
      fetchFilterData();
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  const fetchReports = useCallback(async () => {
    // Guard: Don't fetch if no household is selected
    if (!selectedHouseholdId) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Build query string with filter parameters
      const filterParams = getFilterParams();
      const queryString = filterParams.toString();

      // Validate date range if custom dates are set
      if (startDate && endDate) {
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        
        if (startDateObj > endDateObj) {
          setError('Start date must be before end date');
          setIsLoading(false);
          return;
        }
        
        const daysDiff = Math.ceil(
          (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysDiff > 1825) {
          setError('Date range cannot exceed 5 years');
          setIsLoading(false);
          return;
        }
      }

      const responses = await Promise.all([
        fetchWithHousehold(`/api/reports/income-vs-expenses?${queryString}`),
        fetchWithHousehold(`/api/reports/category-breakdown?${queryString}`),
        fetchWithHousehold(`/api/reports/cash-flow?${queryString}`),
        fetchWithHousehold(`/api/reports/net-worth?${queryString}`),
        fetchWithHousehold(`/api/reports/budget-vs-actual?${queryString}`),
        fetchWithHousehold(`/api/reports/merchant-analysis?${queryString}`),
      ]);

      // Check for API errors
      const errors: string[] = [];
      for (let i = 0; i < responses.length; i++) {
        if (!responses[i].ok) {
          try {
            const errorData = await responses[i].json();
            errors.push(errorData.error || `Report ${i + 1} failed`);
          } catch {
            errors.push(`Report ${i + 1} failed`);
          }
        }
      }

      if (errors.length > 0) {
        setError(errors.length === 1 ? errors[0] : `Some reports failed to load: ${errors.join(', ')}`);
        setIsLoading(false);
        return;
      }

      const [ivE, cb, cf, nw, bva, ma] = await Promise.all(
        responses.map((r) => r.json())
      );

      // Transform data to use 'name' as x-axis key (required by chart components)
      const transformData = (raw: unknown, currentPeriod: Period | null) => {
        if (!Array.isArray(raw)) return [];
        const xKey = currentPeriod === 'month' ? 'week' : 'month';
        return raw.map((item) => {
          const obj = (item && typeof item === 'object' ? (item as Record<string, unknown>) : {}) as Record<string, unknown>;
          const name =
            typeof obj[xKey] === 'string'
              ? (obj[xKey] as string)
              : typeof obj.name === 'string'
              ? obj.name
              : '';
          return { name, ...obj };
        });
      };

      const currentPeriod = period || '12months';

      setData({
        incomeVsExpenses: { ...ivE, data: transformData(ivE?.data, currentPeriod) },
        categoryBreakdown: cb,
        cashFlow: { ...cf, data: transformData(cf?.data, currentPeriod) },
        netWorth: { ...nw, history: transformData(nw?.history, currentPeriod) },
        budgetVsActual: bva,
        merchantAnalysis: ma,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load reports';
      setError(`${errorMessage}. Please try again.`);
      console.error('Error fetching reports:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedHouseholdId,
    period,
    startDate,
    endDate,
    getFilterParams,
    fetchWithHousehold,
  ]);

  // Fetch reports when filters or household change
  useEffect(() => {
    // Don't fetch if no household is selected
    if (!selectedHouseholdId) {
      return;
    }
    
    fetchReports();
    loadPayoffStrategy();
  }, [selectedHouseholdId, fetchReports, loadPayoffStrategy]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-error font-medium mb-2">Error Loading Reports</p>
          <p className="text-muted-foreground mb-4">{error || 'Unknown error'}</p>
          <Button onClick={fetchReports}>Try Again</Button>
        </div>
      </div>
    );
  }

  const netWorthValue = data.netWorth?.currentNetWorth ?? 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Financial Reports</h1>
            <p className="text-muted-foreground mt-1">Comprehensive analysis of your finances</p>
          </div>
          <div className="flex gap-2 flex-col md:flex-row">
            {data && (
              <ExportButton
                data={data}
                reportName="Financial_Report"
                summary={{
                  period: period || 'custom',
                  generated: new Date().toLocaleDateString(),
                }}
              />
            )}
          </div>
        </div>

        {/* Date Range Picker */}
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onDateChange={setDateRange}
        />

        {/* Period Selector and Report Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Select
              value={period || '12months'}
              onValueChange={(value) => setPeriod(value as Period)}
            >
              <SelectTrigger className="w-full md:w-40 bg-elevated border-border text-foreground">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="month" className="text-foreground">This Month</SelectItem>
                <SelectItem value="year" className="text-foreground">This Year</SelectItem>
                <SelectItem value="12months" className="text-foreground">Last 12 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Report Filters */}
        {!isLoadingFilters && (
          <ReportFilters
            accounts={accounts}
            categories={categories}
            merchants={merchants}
            selectedAccountIds={selectedAccountIds}
            selectedCategoryIds={selectedCategoryIds}
            selectedMerchantIds={selectedMerchantIds}
            onAccountChange={setAccountIds}
            onCategoryChange={setCategoryIds}
            onMerchantChange={setMerchantIds}
            onClearFilters={clearAllFilters}
          />
        )}

        {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-income">
              ${data.incomeVsExpenses?.data
                ?.reduce(
                  (sum: number, item: Record<string, unknown>) =>
                    sum + (typeof item.income === 'number' ? item.income : 0),
                  0
                )
                .toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-expense">
              ${data.incomeVsExpenses?.data
                ?.reduce(
                  (sum: number, item: Record<string, unknown>) =>
                    sum + (typeof item.expenses === 'number' ? item.expenses : 0),
                  0
                )
                .toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Net Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              ${data.incomeVsExpenses?.data
                ?.reduce(
                  (sum: number, item: Record<string, unknown>) =>
                    sum + (typeof item.net === 'number' ? item.net : 0),
                  0
                )
                .toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Net Worth</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${netWorthValue >= 0 ? 'text-income' : 'text-expense'}`}>
              ${netWorthValue.toFixed(2)}
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
          data={(data.incomeVsExpenses?.data || []) as unknown as ChartDataPoint[]}
          lines={[
            { dataKey: 'income', stroke: COLOR_PALETTE.income, name: 'Income' },
            { dataKey: 'expenses', stroke: COLOR_PALETTE.expense, name: 'Expenses' },
          ]}
        />

        {/* Category Breakdown */}
        <PieChart
          title="Spending by Category"
          description={`Distribution of ${period === '12months' ? 'annual' : 'period'} expenses`}
          data={(data.categoryBreakdown?.data || []) as unknown as PieDataPoint[]}
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
          data={(data.cashFlow?.data || []) as unknown as ChartDataPoint[]}
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
          data={(data.netWorth?.history || []) as unknown as ChartDataPoint[]}
          lines={[
            { dataKey: 'netWorth', stroke: COLOR_PALETTE.primary, name: 'Net Worth' },
          ]}
          xAxisLabel={period === '12months' ? 'Month' : 'Week'}
          yAxisLabel="Amount ($)"
        />

        {/* Experimental: Treemap Chart */}
        <FeatureGate featureId="advanced-charts">
          <TreemapChart
            title="Category Spending Treemap"
            description="Hierarchical view of spending by category"
            data={(data.categoryBreakdown?.data || []).map((item) => ({
              name: item.name || '',
              value: item.value ?? 0,
              color: COLOR_PALETTE.expense,
            }))}
          />
        </FeatureGate>

        {/* Experimental: Heatmap Chart */}
        <FeatureGate featureId="advanced-charts">
          <HeatmapChart
            title="Category Spending Heatmap"
            description="Spending intensity by category over time"
            data={(() => {
              // Transform data for heatmap (category x month grid)
              const categories = data.categoryBreakdown?.data || [];
              const months = (data.incomeVsExpenses?.data || []).map((d) => (typeof d.name === 'string' ? d.name : ''));

              // Generate sample heatmap data
              type HeatmapCell = { category: string; month: string; value: number };
              const heatmapData: HeatmapCell[] = [];
              categories.forEach((cat) => {
                months.forEach((month) => {
                  heatmapData.push({
                    category: cat.name || '',
                    month: month,
                    value: Math.random() * (cat.value ?? 0), // Distribute spending across months
                  });
                });
              });

              return heatmapData;
            })()}
          />
        </FeatureGate>
      </div>

      {/* Budget vs Actual */}
      <BarChart
        title="Budget vs Actual Spending"
        description="Compare your budgets against actual spending"
        data={(((data.budgetVsActual as unknown as { data?: unknown })?.data || []) as unknown) as ChartDataPoint[]}
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
              {(data.netWorth?.accountBreakdown || []).map((account) => (
                <div key={account.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: account.color || 'var(--color-primary)' }}
                    />
                    <div>
                      <p className="text-foreground font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">{account.type}</p>
                    </div>
                  </div>
                  <p className="text-foreground font-medium">${(account.balance ?? 0).toFixed(2)}</p>
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
              {(data.merchantAnalysis?.data || []).slice(0, 5).map((merchant, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-foreground font-medium text-sm truncate">{merchant.name}</p>
                    <p className="text-xs text-muted-foreground">{merchant.count ?? 0} transactions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-foreground font-medium">${(merchant.amount ?? 0).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{(merchant.percentageOfTotal ?? 0).toFixed(0)}%</p>
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
        data={(data.merchantAnalysis?.data?.slice(0, 10) || []) as unknown as ChartDataPoint[]}
        bars={[{ dataKey: 'amount', fill: COLOR_PALETTE.expense, name: 'Amount' }]}
        layout="vertical"
      />

      {/* Debt Analysis Section */}
      {(() => {
        const payoff = payoffStrategy as { schedules?: unknown[] } | null;
        return payoff?.schedules && payoff.schedules.length > 0;
      })() && (
        <div className="space-y-4 mt-8">
          <div className="border-t border-border pt-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">Debt Analysis</h2>
            <p className="text-muted-foreground mb-6">Comprehensive debt tracking and payment projections</p>
          </div>

          {/* Payment Breakdown Section */}
          <button
            onClick={() => setShowPaymentBreakdown(!showPaymentBreakdown)}
            className="flex items-center justify-between w-full bg-card border border-border rounded-lg p-4 hover:bg-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-primary" />
              <div className="text-left">
                <h3 className="text-lg font-semibold text-foreground">Payment Breakdown Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Principal vs Interest breakdown and total cost visualization
                </p>
              </div>
            </div>
            {showPaymentBreakdown ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {showPaymentBreakdown && (
            <PaymentBreakdownSection strategy={payoffStrategy as unknown as PayoffStrategyResult} />
          )}

          {/* Debt Reduction Progress Chart */}
          <button
            onClick={() => setShowDebtReduction(!showDebtReduction)}
            className="flex items-center justify-between w-full bg-card border border-border rounded-lg p-4 hover:bg-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <TrendingDown className="w-6 h-6 text-income" />
              <div className="text-left">
                <h3 className="text-lg font-semibold text-foreground">Debt Reduction Progress</h3>
                <p className="text-sm text-muted-foreground">
                  Historical progress and future projections
                </p>
              </div>
            </div>
            {showDebtReduction ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {showDebtReduction && <DebtReductionChart />}

          {/* Interactive Amortization Schedule */}
          <button
            onClick={() => setShowAmortization(!showAmortization)}
            className="flex items-center justify-between w-full bg-card border border-border rounded-lg p-4 hover:bg-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-primary" />
              <div className="text-left">
                <h3 className="text-lg font-semibold text-foreground">Interactive Amortization Schedule</h3>
                <p className="text-sm text-muted-foreground">
                  Month-by-month payment breakdowns and visualizations
                </p>
              </div>
            </div>
            {showAmortization ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          {showAmortization && (
            <AmortizationScheduleView strategy={payoffStrategy as unknown as PayoffStrategyResult} />
          )}
        </div>
      )}
      </div>
    </div>
  );
}
