'use client';

import { useEffect, useState } from 'react';
import { TotalDebtChart } from './total-debt-chart';
import { IndividualDebtsChart } from './individual-debts-chart';
import { DebtReductionSummary } from './debt-reduction-summary';
import { ChevronDown } from 'lucide-react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';

interface ChartDataPoint {
  month: string;
  projectedTotal: number;
  actualTotal: number;
  byDebt: Record<string, number>;
}

interface DebtDetail {
  id: string;
  name: string;
  originalBalance: number;
  currentBalance: number;
  payoffDate: string | null;
  color: string;
}

interface ChartSummary {
  totalOriginalDebt: number;
  totalCurrentDebt: number;
  totalPaid: number;
  percentageComplete: number;
  debtFreeDate: string | null;
}

interface ChartResponse {
  chartData: ChartDataPoint[];
  projectionStartDate: string;
  debtDetails: DebtDetail[];
  summary: ChartSummary;
}

type ViewMode = 'combined' | 'individual' | 'both';

interface DebtReductionChartProps {
  defaultViewMode?: ViewMode;
}

export function DebtReductionChart({
  defaultViewMode = 'combined',
}: DebtReductionChartProps) {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<ChartResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedHouseholdId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetchWithHousehold('/api/debts/reduction-chart');
        if (!response.ok) {
          throw new Error('Failed to fetch debt reduction chart data');
        }

        const chartData = await response.json();
        setData(chartData);
      } catch (err) {
        console.error('Error fetching debt reduction chart:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load debt reduction chart'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedHouseholdId, fetchWithHousehold]);

  // Empty state - no debts
  if (!isLoading && (!data || data.debtDetails.length === 0)) {
    return null;
  }

  return (
    <div className="w-full mb-6">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 rounded-lg border transition-colors"
        style={{
          backgroundColor: 'var(--color-background)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-foreground)' }}>
            Debt Reduction Progress
          </h2>
          {!isExpanded && data && (
            <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              {Math.round(data.summary.percentageComplete)}% complete
            </span>
          )}
        </div>
        <ChevronDown
          size={20}
          className="transition-transform"
          style={{ color: 'var(--color-muted-foreground)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-6">
          {/* Summary Stats */}
          {data && (
            <DebtReductionSummary
              summary={data.summary}
              isLoading={isLoading}
            />
          )}

          {/* View Mode Toggle */}
          {data && data.debtDetails.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setViewMode('combined')}
                className="px-3 py-2 rounded text-sm font-medium transition-colors"
                style={{
                  backgroundColor: viewMode === 'combined' ? 'var(--color-primary)' : 'var(--color-elevated)',
                  color: viewMode === 'combined' ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                }}
              >
                Total Debt
              </button>
              <button
                onClick={() => setViewMode('individual')}
                className="px-3 py-2 rounded text-sm font-medium transition-colors"
                style={{
                  backgroundColor: viewMode === 'individual' ? 'var(--color-primary)' : 'var(--color-elevated)',
                  color: viewMode === 'individual' ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                }}
              >
                By Debt
              </button>
              <button
                onClick={() => setViewMode('both')}
                className="px-3 py-2 rounded text-sm font-medium transition-colors"
                style={{
                  backgroundColor: viewMode === 'both' ? 'var(--color-primary)' : 'var(--color-elevated)',
                  color: viewMode === 'both' ? 'var(--color-primary-foreground)' : 'var(--color-muted-foreground)',
                }}
              >
                Both
              </button>
            </div>
          )}

          {/* Charts */}
          {error ? (
            <div
              className="p-4 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--color-destructive)', color: 'var(--color-primary-foreground)' }}
            >
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Combined view - Total debt chart */}
              {(viewMode === 'combined' || viewMode === 'both') && data && (
                <div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-foreground)' }}>
                    Total Debt Timeline
                  </h3>
                  <TotalDebtChart
                    data={data.chartData}
                    isLoading={isLoading}
                  />
                </div>
              )}

              {/* Individual view - Stacked debt chart */}
              {(viewMode === 'individual' || viewMode === 'both') &&
                data &&
                data.debtDetails.length > 1 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-foreground)' }}>
                      Individual Debt Balances
                    </h3>
                    <IndividualDebtsChart
                      data={data.chartData}
                      debtDetails={data.debtDetails}
                      isLoading={isLoading}
                    />
                  </div>
                )}

              {/* Single debt - just show combined view */}
              {data && data.debtDetails.length === 1 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-foreground)' }}>
                    {data.debtDetails[0]?.name} Balance
                  </h3>
                  <TotalDebtChart
                    data={data.chartData}
                    isLoading={isLoading}
                  />
                </div>
              )}
            </div>
          )}

          {/* Info box */}
          <div
            className="p-3 rounded-lg text-xs"
            style={{
              backgroundColor: 'var(--color-elevated)',
              color: 'var(--color-muted-foreground)',
            }}
          >
            <p className="mb-1">
              <span className="font-semibold">Actual</span> shows your true debt
              balance based on payment history.
            </p>
            <p>
              <span className="font-semibold">Projected</span> shows the
              estimated path to debt-free based on current payment plan.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
