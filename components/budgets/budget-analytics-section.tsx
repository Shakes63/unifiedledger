'use client';

import React, { useState, useEffect } from 'react';
import { BudgetAnalyticsChart } from './budget-analytics-chart';
import { CategoryTrendChart } from './category-trend-chart';
import { toast } from 'sonner';
import { BarChart3, Settings, AlertTriangle, DollarSign, Lightbulb } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface AnalyticsData {
  period: {
    startMonth: string;
    endMonth: string;
    monthCount: number;
  };
  summary: {
    averageMonthlyIncome: number;
    averageMonthlyExpenses: number;
    averageMonthlySavings: number;
    averageSavingsRate: number;
    totalIncome: number;
    totalExpenses: number;
    totalSavings: number;
    overallSavingsRate: number;
  };
  monthlyBreakdown: Array<{
    month: string;
    totalIncome: number;
    totalExpenses: number;
    savings: number;
    savingsRate: number;
    budgetAdherence: number;
    categoriesOverBudget: number;
    categoriesOnTrack: number;
  }>;
  categoryTrends: Array<{
    categoryId: string;
    categoryName: string;
    categoryType: string;
    monthlyData: Array<{
      month: string;
      budgeted: number;
      actual: number;
      variance: number;
      percentOfBudget: number;
    }>;
    trend: {
      direction: 'increasing' | 'decreasing' | 'stable';
      percentChange: number;
      averageSpending: number;
      consistency: number;
    };
    insights: string[];
  }>;
  overspendingRanking: Array<{
    categoryId: string;
    categoryName: string;
    averageOverage: number;
    monthsOverBudget: number;
    totalOverage: number;
    severity: 'critical' | 'high' | 'moderate';
  }>;
  recommendations: Array<{
    type: 'budget_adjustment' | 'spending_alert' | 'savings_opportunity' | 'consistency_improvement';
    categoryId: string | null;
    priority: 'high' | 'medium' | 'low';
    message: string;
    suggestedAction: string;
    potentialSavings: number | null;
  }>;
}

interface BudgetAnalyticsSectionProps {
  hideHeader?: boolean;
}

export function BudgetAnalyticsSection({ hideHeader = false }: BudgetAnalyticsSectionProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthsPeriod, setMonthsPeriod] = useState<number>(6);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Fetch analytics data
  useEffect(() => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetchWithHousehold(`/api/budgets/analyze?months=${monthsPeriod}`);

        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }

        const data = await response.json();
        setAnalyticsData(data);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        if (err instanceof Error && err.message === 'No household selected') {
          setLoading(false);
          return;
        }
        setError(err instanceof Error ? err.message : 'An error occurred');
        toast.error('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [monthsPeriod, selectedHouseholdId, fetchWithHousehold]);

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Get savings rate quality label
  const getSavingsRateLabel = (rate: number) => {
    if (rate >= 20) return { label: 'Excellent', colorStyle: { color: 'var(--color-success)' } };
    if (rate >= 10) return { label: 'Good', colorStyle: { color: 'var(--color-success)' } };
    if (rate >= 5) return { label: 'Fair', colorStyle: { color: 'var(--color-warning)' } };
    return { label: 'Needs Improvement', colorStyle: { color: 'var(--color-destructive)' } };
  };

  // Get recommendation icon
  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'budget_adjustment':
        return <Settings className="w-5 h-5" />;
      case 'spending_alert':
        return <AlertTriangle className="w-5 h-5" />;
      case 'savings_opportunity':
        return <DollarSign className="w-5 h-5" />;
      case 'consistency_improvement':
        return <BarChart3 className="w-5 h-5" />;
      default:
        return <Lightbulb className="w-5 h-5" />;
    }
  };

  // Get recommendation priority color
  const getPriorityColor = (priority: string): React.CSSProperties => {
    if (priority === 'high') return { border: '1px solid var(--color-destructive)', backgroundColor: 'color-mix(in oklch, var(--color-destructive) 10%, transparent)' };
    if (priority === 'medium') return { border: '1px solid var(--color-warning)', backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)' };
    return { border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' };
  };

  if (loading && !analyticsData) {
    return (
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-center py-12">
          <div style={{ color: 'var(--color-muted-foreground)' }}>Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (error || !analyticsData) {
    return (
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div style={{ color: 'var(--color-destructive)' }}>{error || 'Failed to load analytics'}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm rounded-lg hover:opacity-90"
            style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const savingsRateQuality = getSavingsRateLabel(analyticsData.summary.averageSavingsRate);
  const topCategories = analyticsData.categoryTrends
    .sort((a, b) => b.trend.averageSpending - a.trend.averageSpending)
    .slice(0, showAllCategories ? analyticsData.categoryTrends.length : 5);

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex items-center justify-between">
        {!hideHeader && (
          <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--color-foreground)' }}>
            <BarChart3 className="w-5 h-5" />
            Budget Analytics
          </h2>
        )}
        <select
          id="budget-analytics-period"
          name="analytics_period"
          aria-label="Select analytics time period"
          value={monthsPeriod}
          onChange={e => setMonthsPeriod(parseInt(e.target.value))}
          className={`rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${hideHeader ? 'ml-auto' : ''}`}
          style={{ backgroundColor: 'var(--color-input)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }}
        >
          <option value={3}>Last 3 Months</option>
          <option value={6}>Last 6 Months</option>
          <option value={12}>Last 12 Months</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Avg Monthly Income</div>
          <div className="text-2xl font-semibold" style={{ color: 'var(--color-foreground)' }}>
            ${analyticsData.summary.averageMonthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Avg Monthly Expenses</div>
          <div className="text-2xl font-semibold" style={{ color: 'var(--color-foreground)' }}>
            ${analyticsData.summary.averageMonthlyExpenses.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Avg Monthly Savings</div>
          <div className="text-2xl font-semibold" style={{ color: analyticsData.summary.averageMonthlySavings >= 0 ? 'var(--color-success)' : 'var(--color-destructive)' }}>
            ${Math.abs(analyticsData.summary.averageMonthlySavings).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <div className="text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>Avg Savings Rate</div>
          <div className="text-2xl font-semibold" style={{ color: 'var(--color-foreground)' }}>
            {analyticsData.summary.averageSavingsRate.toFixed(1)}%
          </div>
          <div className="text-xs font-medium mt-1" style={savingsRateQuality.colorStyle}>
            {savingsRateQuality.label}
          </div>
        </div>
      </div>

      {/* Monthly Trends Chart */}
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-foreground)' }}>Monthly Trends</h3>
        <BudgetAnalyticsChart
          data={analyticsData.monthlyBreakdown}
          height={350}
        />
      </div>

      {/* Category Trends */}
      {topCategories.length > 0 && (
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>
              {showAllCategories ? 'All Categories' : 'Top 5 Categories by Spending'}
            </h3>
            {analyticsData.categoryTrends.length > 5 && (
              <button
                onClick={() => setShowAllCategories(!showAllCategories)}
                className="text-sm hover:opacity-80 transition-opacity"
                style={{ color: 'var(--color-primary)' }}
              >
                {showAllCategories ? 'Show Less' : 'View All'}
              </button>
            )}
          </div>
          <div className="space-y-4">
            {topCategories.map(category => (
              <div key={category.categoryId} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                <button
                  onClick={() => toggleCategory(category.categoryId)}
                  className="w-full px-4 py-3 flex items-center justify-between transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-elevated)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>{category.categoryName}</span>
                    <span className="text-xs px-2 py-1 rounded-md capitalize" style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}>
                      {category.categoryType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 transition-transform ${
                      expandedCategories.has(category.categoryId) ? 'rotate-180' : ''
                    }`}
                    style={{ color: 'var(--color-muted-foreground)' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedCategories.has(category.categoryId) && (
                  <div className="px-4 pb-4">
                    <CategoryTrendChart
                      categoryName={category.categoryName}
                      data={category.monthlyData}
                      trend={category.trend}
                    />
                    {category.insights.length > 0 && (
                      <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-muted)' }}>
                        <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>Insights:</div>
                        <ul className="space-y-1">
                          {category.insights.map((insight, idx) => (
                            <li key={idx} className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                              • {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overspending Alert */}
      {analyticsData.overspendingRanking.length > 0 && (
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-warning)' }}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5" style={{ color: 'var(--color-warning)' }} />
                <h3 className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>Overspending Alert</h3>
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
                {analyticsData.overspendingRanking.length} {analyticsData.overspendingRanking.length === 1 ? 'category' : 'categories'} consistently over budget
              </p>
              <div className="flex flex-wrap gap-2">
                {analyticsData.overspendingRanking.slice(0, 3).map(cat => (
                  <span
                    key={cat.categoryId}
                    className="text-xs px-3 py-1.5 rounded-md font-medium"
                    style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 10%, transparent)', color: 'var(--color-warning)' }}
                  >
                    {cat.categoryName}
                  </span>
                ))}
                {analyticsData.overspendingRanking.length > 3 && (
                  <span className="text-xs px-3 py-1.5 rounded-md" style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-muted-foreground)' }}>
                    +{analyticsData.overspendingRanking.length - 3} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {analyticsData.recommendations.length > 0 && (
        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-foreground)' }}>
            <Lightbulb className="w-5 h-5" />
            Recommendations
          </h3>
          <div className="space-y-3">
            {analyticsData.recommendations.slice(0, 5).map((rec, idx) => (
              <div
                key={idx}
                className="p-4 border rounded-lg"
                style={getPriorityColor(rec.priority)}
              >
                <div className="flex items-start gap-3">
                  {getRecommendationIcon(rec.type)}
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>{rec.message}</p>
                    <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>{rec.suggestedAction}</p>
                    {rec.potentialSavings && rec.potentialSavings > 0 && (
                      <p className="text-xs mt-2 font-medium" style={{ color: 'var(--color-success)' }}>
                        Potential savings: ${rec.potentialSavings.toFixed(0)}/month
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
