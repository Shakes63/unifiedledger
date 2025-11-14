'use client';

import React, { useState, useEffect } from 'react';
import { BudgetAnalyticsChart } from './budget-analytics-chart';
import { CategoryTrendChart } from './category-trend-chart';
import { toast } from 'sonner';
import { BarChart3, Settings, AlertTriangle, DollarSign, Lightbulb } from 'lucide-react';

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

export function BudgetAnalyticsSection() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthsPeriod, setMonthsPeriod] = useState<number>(6);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/budgets/analyze?months=${monthsPeriod}`, { credentials: 'include' });

        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }

        const data = await response.json();
        setAnalyticsData(data);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        toast.error('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [monthsPeriod]);

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
    if (rate >= 20) return { label: 'Excellent', color: 'text-[var(--color-success)]' };
    if (rate >= 10) return { label: 'Good', color: 'text-[var(--color-success)]' };
    if (rate >= 5) return { label: 'Fair', color: 'text-[var(--color-warning)]' };
    return { label: 'Needs Improvement', color: 'text-[var(--color-error)]' };
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
  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return 'border-[var(--color-error)] bg-[var(--color-error)]/10';
    if (priority === 'medium') return 'border-[var(--color-warning)] bg-[var(--color-warning)]/10';
    return 'border-border bg-card';
  };

  if (loading && !analyticsData) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (error || !analyticsData) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="text-[var(--color-error)]">{error || 'Failed to load analytics'}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm rounded-lg hover:opacity-90"
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
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Budget Analytics
        </h2>
        <select
          id="budget-analytics-period"
          name="analytics_period"
          aria-label="Select analytics time period"
          value={monthsPeriod}
          onChange={e => setMonthsPeriod(parseInt(e.target.value))}
          className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value={3}>Last 3 Months</option>
          <option value={6}>Last 6 Months</option>
          <option value={12}>Last 12 Months</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg Monthly Income</div>
          <div className="text-2xl font-semibold text-foreground">
            ${analyticsData.summary.averageMonthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg Monthly Expenses</div>
          <div className="text-2xl font-semibold text-foreground">
            ${analyticsData.summary.averageMonthlyExpenses.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg Monthly Savings</div>
          <div className={`text-2xl font-semibold ${analyticsData.summary.averageMonthlySavings >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
            ${Math.abs(analyticsData.summary.averageMonthlySavings).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg Savings Rate</div>
          <div className="text-2xl font-semibold text-foreground">
            {analyticsData.summary.averageSavingsRate.toFixed(1)}%
          </div>
          <div className={`text-xs font-medium mt-1 ${savingsRateQuality.color}`}>
            {savingsRateQuality.label}
          </div>
        </div>
      </div>

      {/* Monthly Trends Chart */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">Monthly Trends</h3>
        <BudgetAnalyticsChart
          data={analyticsData.monthlyBreakdown}
          height={350}
        />
      </div>

      {/* Category Trends */}
      {topCategories.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-foreground">
              {showAllCategories ? 'All Categories' : 'Top 5 Categories by Spending'}
            </h3>
            {analyticsData.categoryTrends.length > 5 && (
              <button
                onClick={() => setShowAllCategories(!showAllCategories)}
                className="text-sm text-[var(--color-primary)] hover:opacity-80 transition-opacity"
              >
                {showAllCategories ? 'Show Less' : 'View All'}
              </button>
            )}
          </div>
          <div className="space-y-4">
            {topCategories.map(category => (
              <div key={category.categoryId} className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(category.categoryId)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-elevated transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{category.categoryName}</span>
                    <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-md capitalize">
                      {category.categoryType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-muted-foreground transition-transform ${
                      expandedCategories.has(category.categoryId) ? 'rotate-180' : ''
                    }`}
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
                      <div className="mt-3 p-3 bg-muted rounded-lg">
                        <div className="text-xs font-medium text-foreground mb-1">Insights:</div>
                        <ul className="space-y-1">
                          {category.insights.map((insight, idx) => (
                            <li key={idx} className="text-xs text-muted-foreground">
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
        <div className="bg-card border border-[var(--color-warning)] rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-[var(--color-warning)]" />
                <h3 className="text-base font-semibold text-foreground">Overspending Alert</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {analyticsData.overspendingRanking.length} {analyticsData.overspendingRanking.length === 1 ? 'category' : 'categories'} consistently over budget
              </p>
              <div className="flex flex-wrap gap-2">
                {analyticsData.overspendingRanking.slice(0, 3).map(cat => (
                  <span
                    key={cat.categoryId}
                    className="text-xs px-3 py-1.5 bg-[var(--color-warning)]/10 text-[var(--color-warning)] rounded-md font-medium"
                  >
                    {cat.categoryName}
                  </span>
                ))}
                {analyticsData.overspendingRanking.length > 3 && (
                  <span className="text-xs px-3 py-1.5 bg-muted text-muted-foreground rounded-md">
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
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Recommendations
          </h3>
          <div className="space-y-3">
            {analyticsData.recommendations.slice(0, 5).map((rec, idx) => (
              <div
                key={idx}
                className={`p-4 border rounded-lg ${getPriorityColor(rec.priority)}`}
              >
                <div className="flex items-start gap-3">
                  {getRecommendationIcon(rec.type)}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground mb-1">{rec.message}</p>
                    <p className="text-sm text-muted-foreground">{rec.suggestedAction}</p>
                    {rec.potentialSavings && rec.potentialSavings > 0 && (
                      <p className="text-xs text-[var(--color-success)] mt-2 font-medium">
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
