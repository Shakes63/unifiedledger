'use client';

import { useEffect, useState } from 'react';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import Link from 'next/link';
import { ChevronRight, Receipt } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ClassificationSummaryItem {
  classification: string;
  label: string;
  count: number;
  totalMonthly: number;
  upcomingCount: number;
  upcomingAmount: number;
  color: string;
}

interface ClassificationSummaryResponse {
  data: ClassificationSummaryItem[];
  totals: {
    totalCount: number;
    totalMonthly: number;
    totalUpcomingCount: number;
    totalUpcomingAmount: number;
  };
}

export function BillsByClassificationWidget() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<ClassificationSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedHouseholdId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetchWithHousehold('/api/bills/classification-summary');
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Error fetching classification summary:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedHouseholdId, fetchWithHousehold]);

  if (loading) {
    return (
      <div
        className="rounded-xl border p-4"
        style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--color-foreground)' }}>Bills by Category</span>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-[160px] rounded-lg" style={{ backgroundColor: 'var(--color-elevated)' }} />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 rounded" style={{ backgroundColor: 'var(--color-elevated)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div
        className="rounded-xl border p-4"
        style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--color-foreground)' }}>Bills by Category</span>
        </div>
        <div className="text-center py-6">
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>No active bills</p>
          <Link
            href="/dashboard/bills/new"
            className="text-sm hover:underline mt-2 inline-block"
            style={{ color: 'var(--color-primary)' }}
          >
            Add your first bill
          </Link>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = data.data.map((item) => ({
    name: item.label,
    value: item.totalMonthly,
    color: item.color,
    classification: item.classification,
  }));

  const showChart = data.data.length > 1;

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; color: string } }> }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="rounded-lg p-2 shadow-lg" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>{item.name}</p>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            ${item.value.toFixed(2)}/month
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--color-foreground)' }}>Bills by Category</span>
          <span
            className="text-[10px] uppercase tracking-[0.08em]"
            style={{ color: 'var(--color-muted-foreground)', fontVariantNumeric: 'tabular-nums' }}
          >
            ${data.totals.totalMonthly.toFixed(0)}/mo
          </span>
        </div>
        <Link
          href="/dashboard/bills"
          className="transition-colors hover:opacity-80"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Pie Chart with center label */}
      {showChart && (
        <div className="relative h-[160px] mb-4" data-testid="bills-by-category-chart">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ left: 0, right: 0, top: 0, bottom: 0 }}
          >
            <span
              className="text-sm font-bold"
              style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}
            >
              ${data.totals.totalMonthly.toFixed(0)}/mo
            </span>
          </div>
        </div>
      )}

      {/* Category List */}
      <div className="space-y-0.5">
        {data.data.slice(0, 5).map((item) => {
          const percentage = data.totals.totalMonthly > 0
            ? (item.totalMonthly / data.totals.totalMonthly) * 100
            : 0;

          return (
            <Link
              key={item.classification}
              href={`/dashboard/bills?classification=${item.classification}`}
              className="flex items-center justify-between rounded-lg py-1.5 px-3 transition-colors hover:bg-(--color-elevated)"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <span className="text-sm font-medium truncate block" style={{ color: 'var(--color-foreground)' }}>
                    {item.label}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted-foreground)' }}>
                    {item.count} bill{item.count !== 1 ? 's' : ''}
                    {item.upcomingCount > 0 && (
                      <span style={{ color: 'var(--color-warning)', textTransform: 'none' }}>
                        {' \u2022 '}{item.upcomingCount} upcoming
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0 pl-2">
                <span
                  className="text-sm font-medium block"
                  style={{ color: 'var(--color-foreground)', fontVariantNumeric: 'tabular-nums' }}
                >
                  ${item.totalMonthly.toFixed(2)}
                </span>
                <span className="text-[10px] uppercase tracking-[0.08em] block" style={{ color: 'var(--color-muted-foreground)' }}>
                  {percentage.toFixed(0)}%
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Summary Footer */}
      {data.totals.totalUpcomingCount > 0 && (
        <div
          className="mt-3 pt-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted-foreground)' }}>
              Upcoming (30 days)
            </span>
            <span className="font-medium" style={{ color: 'var(--color-warning)', fontVariantNumeric: 'tabular-nums' }}>
              {data.totals.totalUpcomingCount} bills \u2022 ${data.totals.totalUpcomingAmount.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

