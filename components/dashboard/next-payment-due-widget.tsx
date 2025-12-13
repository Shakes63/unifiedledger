'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { 
  CalendarClock, 
  AlertCircle, 
  Clock, 
  CreditCard,
  Zap,
  ArrowRight,
  CheckCircle,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { parseISO, format } from 'date-fns';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import Decimal from 'decimal.js';

interface LinkedAccount {
  id: string;
  name: string;
  type: 'credit' | 'line_of_credit';
  currentBalance: number;
  creditLimit: number;
}

interface NextDueBill {
  id: string;
  billId: string;
  billName: string;
  dueDate: string;
  expectedAmount: number;
  actualAmount?: number;
  status: 'pending' | 'overdue';
  daysUntilDue: number;
  isOverdue: boolean;
  linkedAccount?: LinkedAccount;
  isAutopay: boolean;
  autopayAmount?: number;
  autopayDays?: number;
  autopayAmountType?: string;
  billColor?: string;
  isDebt: boolean;
}

interface NextDueSummary {
  overdueCount: number;
  overdueTotal: number;
  nextDueDate: string | null;
  next7DaysTotal: number;
  next7DaysCount: number;
  totalPendingCount: number;
}

interface NextDueResponse {
  bills: NextDueBill[];
  summary: NextDueSummary;
}

export function NextPaymentDueWidget() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [data, setData] = useState<NextDueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedHouseholdId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchWithHousehold('/api/bills/next-due?limit=5');
      
      if (!response.ok) {
        throw new Error('Failed to fetch next due bills');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching next due bills:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for bill refresh events
  useEffect(() => {
    const handleBillsRefresh = () => {
      if (selectedHouseholdId) {
        fetchData();
      }
    };

    window.addEventListener('bills-refresh', handleBillsRefresh);
    return () => window.removeEventListener('bills-refresh', handleBillsRefresh);
  }, [selectedHouseholdId, fetchData]);

  // Loading state
  if (isLoading) {
    return (
      <Card className="p-4 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="animate-pulse space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-elevated rounded-lg" />
            <div className="h-4 bg-elevated rounded w-32" />
          </div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-elevated rounded-lg" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="p-4 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <AlertCircle className="w-8 h-8 text-error mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load upcoming payments</p>
          <button
            onClick={fetchData}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  // No data or no bills
  if (!data || data.bills.length === 0) {
    return (
      <Card className="p-4 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-elevated rounded-lg">
            <CalendarClock className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Next Payments</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <CheckCircle className="w-10 h-10 text-success mb-2 opacity-50" />
          <p className="text-sm font-medium text-foreground">All caught up!</p>
          <p className="text-xs text-muted-foreground mt-1">No upcoming payments due</p>
        </div>
      </Card>
    );
  }

  const { bills, summary } = data;

  const formatDueDate = (dateString: string) => {
    const date = parseISO(dateString);
    return format(date, 'MMM d');
  };

  const getDaysLabel = (days: number, isOverdue: boolean) => {
    if (isOverdue) {
      const absDays = Math.abs(days);
      if (absDays === 0) return 'Due today';
      if (absDays === 1) return '1 day overdue';
      return `${absDays} days overdue`;
    }
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `Due in ${days} days`;
  };

  const getStatusColor = (bill: NextDueBill) => {
    if (bill.isOverdue) return 'var(--color-error)';
    if (bill.daysUntilDue <= 2) return 'var(--color-warning)';
    return 'var(--color-primary)';
  };

  const formatAmount = (amount: number) => {
    return new Decimal(amount).toFixed(2);
  };

  return (
    <Card className="p-4 border rounded-xl" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-elevated rounded-lg">
            <CalendarClock className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Next Payments</h3>
        </div>
        
        {/* Overdue badge */}
        {summary.overdueCount > 0 && (
          <span 
            className="px-2 py-0.5 text-xs font-medium rounded-full"
            style={{ 
              backgroundColor: 'color-mix(in srgb, var(--color-error) 20%, transparent)',
              color: 'var(--color-error)',
            }}
          >
            {summary.overdueCount} overdue
          </span>
        )}
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Next 7 days: ${formatAmount(summary.next7DaysTotal)}
        </span>
        <span className="text-border">|</span>
        <span>{summary.next7DaysCount + summary.overdueCount} bills</span>
      </div>

      {/* Bills list */}
      <div className="space-y-2">
        {bills.map((bill) => (
          <Link
            key={bill.id}
            href={`/dashboard/bills`}
            className="flex items-center justify-between p-2.5 rounded-lg border transition-all hover:bg-elevated group"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              {/* Status indicator */}
              <div 
                className="w-1.5 h-8 rounded-full shrink-0"
                style={{ backgroundColor: getStatusColor(bill) }}
              />
              
              {/* Bill info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground truncate">
                    {bill.billName}
                  </span>
                  
                  {/* Credit card indicator */}
                  {bill.linkedAccount && (
                    <CreditCard 
                      className="w-3 h-3 shrink-0" 
                      style={{ color: 'var(--color-primary)' }} 
                    />
                  )}
                  
                  {/* Autopay indicator */}
                  {bill.isAutopay && (
                    <span title="Autopay enabled">
                      <Zap 
                        className="w-3 h-3 shrink-0" 
                        style={{ color: 'var(--color-income)' }}
                      />
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-xs">
                  <span 
                    className={bill.isOverdue ? 'font-medium' : ''}
                    style={{ color: getStatusColor(bill) }}
                  >
                    {getDaysLabel(bill.daysUntilDue, bill.isOverdue)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDueDate(bill.dueDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Amount and arrow */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-bold font-mono text-foreground">
                ${formatAmount(bill.expectedAmount)}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        ))}
      </div>

      {/* View all link */}
      {(summary.totalPendingCount + summary.overdueCount > bills.length) && (
        <Link href="/dashboard/bills" className="block mt-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-xs h-8 text-primary hover:bg-elevated"
          >
            View all bills
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      )}
    </Card>
  );
}

