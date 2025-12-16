'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import Link from 'next/link';
import { ChevronRight, Receipt, CreditCard, Zap, Home, Shield, Banknote, Users, Wrench, MoreHorizontal } from 'lucide-react';
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

// Icon mapping for classifications
const CLASSIFICATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  subscription: CreditCard,
  utility: Zap,
  housing: Home,
  insurance: Shield,
  loan_payment: Banknote,
  membership: Users,
  service: Wrench,
  other: MoreHorizontal,
};

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
      <Card className="bg-background border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <Receipt className="w-5 h-5" />
            Bills by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-[180px] bg-card rounded-lg" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 bg-card rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <Card className="bg-background border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <Receipt className="w-5 h-5" />
            Bills by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground text-sm">No active bills</p>
            <Link
              href="/dashboard/bills/new"
              className="text-primary text-sm hover:underline mt-2 inline-block"
            >
              Add your first bill
            </Link>
          </div>
        </CardContent>
      </Card>
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
        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
          <p className="text-sm font-medium text-foreground">{item.name}</p>
          <p className="text-sm text-muted-foreground">
            ${item.value.toFixed(2)}/month
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-background border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <Receipt className="w-5 h-5" />
            Bills by Category
          </CardTitle>
          <Link
            href="/dashboard/bills"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          ${data.totals.totalMonthly.toFixed(2)}/month total
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pie Chart (hide for single-category to avoid excess empty space) */}
        {showChart && (
          <div className="h-[180px]" data-testid="bills-by-category-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
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
          </div>
        )}

        {/* Category List */}
        <div className="space-y-2">
          {data.data.slice(0, 5).map((item) => {
            const Icon = CLASSIFICATION_ICONS[item.classification] || MoreHorizontal;
            const percentage = data.totals.totalMonthly > 0 
              ? (item.totalMonthly / data.totals.totalMonthly) * 100 
              : 0;
            
            return (
              <Link
                key={item.classification}
                href={`/dashboard/bills?classification=${item.classification}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-elevated transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${item.color}20` }}
                  >
                    <span style={{ color: item.color }}>
                      <Icon className="w-4 h-4" />
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.count} bill{item.count !== 1 ? 's' : ''}
                      {item.upcomingCount > 0 && (
                        <span className="text-warning">
                          {' '}&bull; {item.upcomingCount} upcoming
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    ${item.totalMonthly.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {percentage.toFixed(0)}%
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Summary Footer */}
        {data.totals.totalUpcomingCount > 0 && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Upcoming (30 days)</span>
              <span className="text-warning font-medium">
                {data.totals.totalUpcomingCount} bills &bull; ${data.totals.totalUpcomingAmount.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

