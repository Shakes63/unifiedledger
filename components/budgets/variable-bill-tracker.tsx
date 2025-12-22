'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { VariableBillCard } from './variable-bill-card';
import { toast } from 'sonner';
import { FileText, BarChart3, Lightbulb } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface VariableBillData {
  id: string;
  name: string;
  frequency: string | null;
  expectedAmount: number;
  currentMonth: {
    month: string;
    instanceId: string | null;
    expectedAmount: number;
    actualAmount: number | null;
    variance: number | null;
    variancePercent: number | null;
    status: 'pending' | 'paid' | 'overdue' | 'skipped';
    dueDate: string;
    paidDate: string | null;
  };
  historicalAverages: {
    threeMonth: number | null;
    sixMonth: number | null;
    twelveMonth: number | null;
    allTime: number | null;
  };
  monthlyBreakdown: Array<{
    month: string;
    expected: number;
    actual: number | null;
    variance: number | null;
    status: 'pending' | 'paid' | 'overdue' | 'skipped' | null;
  }>;
  trend: {
    direction: 'improving' | 'worsening' | 'stable';
    percentChange: number;
    recommendedBudget: number;
  };
}

interface VariableBillSummary {
  totalExpected: number;
  totalActual: number;
  totalVariance: number;
  variancePercent: number;
  billCount: number;
  paidCount: number;
  pendingCount: number;
}

type FilterType = 'all' | 'under' | 'over' | 'pending';

interface VariableBillTrackerProps {
  hideHeader?: boolean;
}

export function VariableBillTracker({ hideHeader = false }: VariableBillTrackerProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold, putWithHousehold } = useHouseholdFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bills, setBills] = useState<VariableBillData[]>([]);
  const [summary, setSummary] = useState<VariableBillSummary | null>(null);
  const [month, setMonth] = useState<string>('');
  const [expandedBills, setExpandedBills] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>('all');

  // Initialize month to current month
  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setMonth(currentMonth);
  }, []);

  // Fetch variable bill data
  useEffect(() => {
    if (!month || !selectedHouseholdId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetchWithHousehold(`/api/budgets/bills/variable?month=${month}`);

        if (!response.ok) {
          throw new Error('Failed to fetch variable bill data');
        }

        const data = await response.json();
        setBills(data.bills || []);
        setSummary(data.summary || null);
      } catch (err) {
        console.error('Error fetching variable bills:', err);
        if (err instanceof Error && err.message === 'No household selected') {
          setLoading(false);
          return;
        }
        setError(err instanceof Error ? err.message : 'An error occurred');
        toast.error('Failed to load variable bills');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [month, selectedHouseholdId, fetchWithHousehold]);

  // Load expanded state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('variableBillsExpanded');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setExpandedBills(new Set(parsed));
      } catch (_e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Save expanded state to localStorage
  useEffect(() => {
    localStorage.setItem('variableBillsExpanded', JSON.stringify(Array.from(expandedBills)));
  }, [expandedBills]);

  // Toggle bill expansion
  const toggleBillExpansion = (billId: string) => {
    setExpandedBills(prev => {
      const next = new Set(prev);
      if (next.has(billId)) {
        next.delete(billId);
      } else {
        next.add(billId);
      }
      return next;
    });
  };

  // Expand/collapse all
  const expandAll = () => {
    setExpandedBills(new Set(bills.map(b => b.id)));
  };

  const collapseAll = () => {
    setExpandedBills(new Set());
  };

  // Month navigation
  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, monthNum] = month.split('-').map(Number);
    const newDate = new Date(year, monthNum - 1 + (direction === 'next' ? 1 : -1), 1);
    const newMonth = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    setMonth(newMonth);
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setMonth(currentMonth);
  };

  // Update expected amount
  const handleUpdateExpectedAmount = async (billId: string, newAmount: number) => {
    try {
      const response = await putWithHousehold(`/api/bills/${billId}`, {
        expectedAmount: newAmount,
      });

      if (!response.ok) {
        throw new Error('Failed to update expected amount');
      }

      toast.success('Budget updated successfully');

      // Refresh data
      const dataResponse = await fetchWithHousehold(`/api/budgets/bills/variable?month=${month}`);
      const data = await dataResponse.json();
      setBills(data.bills || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Error updating expected amount:', err);
      toast.error('Failed to update budget');
    }
  };

  // Filter bills
  const filteredBills = bills.filter(bill => {
    if (filter === 'all') return true;
    if (filter === 'pending') return bill.currentMonth.status === 'pending';
    if (filter === 'under') {
      return bill.currentMonth.variance !== null && bill.currentMonth.variance < 0;
    }
    if (filter === 'over') {
      return bill.currentMonth.variance !== null && bill.currentMonth.variance > 0;
    }
    return true;
  });

  // Format month for display
  const formatMonth = (monthStr: string) => {
    const [year, monthNum] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  // Calculate overall insights
  const getOverallInsight = () => {
    if (!summary || summary.billCount === 0) return null;

    const underBudgetCount = bills.filter(
      b => b.currentMonth.variance !== null && b.currentMonth.variance < 0
    ).length;

    const underBudgetPercent = Math.round((underBudgetCount / summary.paidCount) * 100);

    if (underBudgetPercent >= 80) {
      return {
        message: `You're doing great! ${underBudgetPercent}% of bills came in under budget this month.`,
        suggestion:
          'Consider reducing budgets for consistently under-budget bills to free up funds.',
      };
    } else if (underBudgetPercent >= 50) {
      return {
        message: `Good progress! ${underBudgetPercent}% of bills came in under budget.`,
        suggestion: 'Review over-budget bills to identify areas for optimization.',
      };
    } else {
      return {
        message: `Most bills exceeded budget this month.`,
        suggestion:
          'Review your usage patterns or adjust budgets to better reflect actual costs.',
      };
    }
  };

  const insight = getOverallInsight();

  if (loading && bills.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading variable bills...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="text-error">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
          <FileText className="w-16 h-16 text-muted-foreground mb-2" />
          <h3 className="text-lg font-semibold text-foreground">No variable bills yet</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Variable bills help you track costs that change month-to-month, like utilities or phone
            bills. Set up your first variable bill to start tracking.
          </p>
          <Link
            href="/dashboard/bills"
            className="mt-4 px-6 py-2 bg-primary text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
          >
            Set up your first variable bill →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Month Navigation */}
      <div className="flex items-center justify-between">
        {!hideHeader && (
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Variable Bills
          </h2>
        )}
        <div className={`flex items-center gap-2 ${hideHeader ? 'ml-auto' : ''}`}>
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-elevated rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToCurrentMonth}
            className="px-4 py-2 text-sm font-medium text-foreground hover:bg-elevated rounded-lg transition-colors"
          >
            {formatMonth(month)}
          </button>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-elevated rounded-lg transition-colors"
            aria-label="Next month"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Summary Card */}
      {summary && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total Expected</div>
              <div className="text-lg font-semibold text-foreground">
                ${summary.totalExpected.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total Actual</div>
              <div className="text-lg font-semibold text-foreground">
                ${summary.totalActual.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Variance</div>
              <div
                className={`text-lg font-semibold ${
                  summary.totalVariance < 0
                    ? 'text-success'
                    : summary.totalVariance > 0
                    ? 'text-error'
                    : 'text-muted-foreground'
                }`}
              >
                {summary.totalVariance < 0 ? '✓ ' : summary.totalVariance > 0 ? '' : ''}$
                {Math.abs(summary.totalVariance).toFixed(2)}
                {summary.totalVariance < 0 ? ' saved' : summary.totalVariance > 0 ? ' over' : ''}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Bills</div>
              <div className="text-lg font-semibold text-foreground">{summary.billCount} total</div>
              <div className="text-xs text-muted-foreground">
                {summary.paidCount} paid • {summary.pendingCount} pending
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          id="variable-bills-filter"
          name="bill_filter"
          aria-label="Filter variable bills by status"
          value={filter}
          onChange={e => setFilter(e.target.value as FilterType)}
          className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Bills</option>
          <option value="under">Under Budget</option>
          <option value="over">Over Budget</option>
          <option value="pending">Pending</option>
        </select>
        <button
          onClick={expandAll}
          className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-elevated rounded-lg transition-colors"
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-elevated rounded-lg transition-colors"
        >
          Collapse All
        </button>
        <div className="ml-auto text-xs text-muted-foreground">
          {filteredBills.length} {filteredBills.length === 1 ? 'bill' : 'bills'}
        </div>
      </div>

      {/* Bill List */}
      <div className="space-y-3">
        {filteredBills.map(bill => (
          <VariableBillCard
            key={bill.id}
            bill={bill}
            isExpanded={expandedBills.has(bill.id)}
            onToggleExpand={() => toggleBillExpansion(bill.id)}
            onUpdateExpectedAmount={handleUpdateExpectedAmount}
          />
        ))}
      </div>

      {/* Overall Insights */}
      {insight && summary && summary.paidCount > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-6 h-6 text-warning" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground mb-1">Overall Insight</h3>
              <p className="text-sm text-foreground mb-2">{insight.message}</p>
              <p className="text-sm text-muted-foreground">{insight.suggestion}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
