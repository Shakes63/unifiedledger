'use client';

import { useEffect, useState } from 'react';
import { useHousehold } from '@/contexts/household-context';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Receipt,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Decimal from 'decimal.js';
import Link from 'next/link';

interface BillItem {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  isAutopay?: boolean;
  categoryName?: string;
}

interface PaidItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  categoryName?: string;
}

interface BudgetPeriodResponse {
  currentPeriod: {
    start: string;
    end: string;
    label: string;
    daysRemaining: number;
    periodNumber: number;
    periodsInMonth: number;
  };
  settings: {
    frequency: string;
    rolloverEnabled: boolean;
  };
  periodBudget: number;
  monthlyBudget: number;
  cashBalance: number;
  paidThisPeriod: number;
  autopayDue: number;
  manualBillsDue: number;
  billsBreakdown: {
    paid: PaidItem[];
    autopayUpcoming: BillItem[];
    manualUpcoming: BillItem[];
  };
  available: number;
  rolloverFromPrevious: number;
  summary: {
    totalCommitted: number;
    percentOfBudgetUsed: number;
    dailyBudgetRemaining: number;
  };
}

export function BudgetPeriodWidget() {
  const { selectedHouseholdId, initialized, loading: householdLoading } = useHousehold();
  const [data, setData] = useState<BudgetPeriodResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<'paid' | 'autopay' | 'manual' | null>(null);

  useEffect(() => {
    if (!initialized || householdLoading || !selectedHouseholdId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/budget-schedule/available?householdId=${selectedHouseholdId}`,
          { credentials: 'include' }
        );
        
        if (response.ok) {
          const result = await response.json();
          // Only show widget if user has a non-monthly budget cycle
          if (result.settings?.frequency && result.settings.frequency !== 'monthly') {
            setData(result);
          } else {
            setData(null);
          }
        }
      } catch (error) {
        console.error('Failed to fetch budget period data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [initialized, householdLoading, selectedHouseholdId]);

  if (loading) {
    return (
      <div className="rounded-xl border p-6 animate-pulse" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
        <div className="h-6 w-48 rounded mb-4" style={{ backgroundColor: 'var(--color-elevated)' }} />
        <div className="h-4 w-32 rounded mb-6" style={{ backgroundColor: 'var(--color-elevated)' }} />
        <div className="h-20 rounded" style={{ backgroundColor: 'var(--color-elevated)' }} />
      </div>
    );
  }

  if (!data) {
    return null; // Don't show widget if using monthly budget
  }

  const formatCurrency = (amount: number) => {
    return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const toggleSection = (section: 'paid' | 'autopay' | 'manual') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const isNegative = data.available < 0;
  const percentUsed = Math.min(100, data.summary.percentOfBudgetUsed);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">{data.currentPeriod.label}</h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{data.currentPeriod.daysRemaining} days left</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDate(data.currentPeriod.start)} - {formatDate(data.currentPeriod.end)}
        </p>
      </div>

      {/* Available Amount - Hero Section */}
      <div
        className="p-6 text-center"
        style={{
          backgroundColor: isNegative ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
        }}
      >
        <p className="text-sm text-muted-foreground mb-1">Available This Period</p>
        <p
          className="text-4xl font-bold"
          style={{
            color: isNegative ? 'var(--color-error)' : 'var(--color-success)',
          }}
        >
          {isNegative && '-'}{formatCurrency(data.available)}
        </p>
        {isNegative && (
          <div className="flex items-center justify-center gap-1 mt-2 text-error">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Over budget</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Spent: {formatCurrency(data.paidThisPeriod)}</span>
          <span>Budget: {formatCurrency(data.periodBudget)}</span>
        </div>
        <Progress 
          value={percentUsed} 
          className="h-2"
          style={{
            backgroundColor: 'var(--color-elevated)',
          }}
        />
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {data.summary.percentOfBudgetUsed.toFixed(0)}% used
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2 p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Cash Balance</p>
          <p className="font-semibold text-foreground">{formatCurrency(data.cashBalance)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Bills Due</p>
          <p className="font-semibold text-foreground">
            {formatCurrency(new Decimal(data.autopayDue).plus(data.manualBillsDue).toNumber())}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Daily Budget</p>
          <p className="font-semibold text-foreground">{formatCurrency(data.summary.dailyBudgetRemaining)}</p>
        </div>
      </div>

      {/* Bills Breakdown */}
      <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        {/* Paid This Period */}
        {data.billsBreakdown.paid.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('paid')}
              className="w-full flex items-center justify-between p-3 hover:bg-elevated transition-colors"
            >
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">Paid This Period</span>
                <span className="text-xs text-muted-foreground">
                  ({data.billsBreakdown.paid.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-expense">
                  -{formatCurrency(data.paidThisPeriod)}
                </span>
                {expandedSection === 'paid' ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>
            {expandedSection === 'paid' && (
              <div className="px-4 pb-3 space-y-2">
                {data.billsBreakdown.paid.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-foreground">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.date)}
                        {item.categoryName && ` - ${item.categoryName}`}
                      </p>
                    </div>
                    <span className="text-expense">-{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                {data.billsBreakdown.paid.length > 5 && (
                  <Link href="/dashboard/transactions" className="text-xs text-primary hover:underline">
                    View all {data.billsBreakdown.paid.length} transactions
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Autopay Upcoming */}
        {data.billsBreakdown.autopayUpcoming.length > 0 && (
          <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={() => toggleSection('autopay')}
              className="w-full flex items-center justify-between p-3 hover:bg-elevated transition-colors"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">Autopay Bills</span>
                <span className="text-xs text-muted-foreground">
                  ({data.billsBreakdown.autopayUpcoming.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-warning">
                  -{formatCurrency(data.autopayDue)}
                </span>
                {expandedSection === 'autopay' ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>
            {expandedSection === 'autopay' && (
              <div className="px-4 pb-3 space-y-2">
                {data.billsBreakdown.autopayUpcoming.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-foreground">{bill.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(bill.dueDate)}
                      </p>
                    </div>
                    <span className="text-warning">-{formatCurrency(bill.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manual Bills Due */}
        {data.billsBreakdown.manualUpcoming.length > 0 && (
          <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
            <button
              onClick={() => toggleSection('manual')}
              className="w-full flex items-center justify-between p-3 hover:bg-elevated transition-colors"
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-error" />
                <span className="text-sm text-foreground">Bills to Pay</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-error/20 text-error">
                  Action needed
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-error">
                  -{formatCurrency(data.manualBillsDue)}
                </span>
                {expandedSection === 'manual' ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>
            {expandedSection === 'manual' && (
              <div className="px-4 pb-3 space-y-2">
                {data.billsBreakdown.manualUpcoming.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-foreground">{bill.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(bill.dueDate)}
                      </p>
                    </div>
                    <span className="text-error">-{formatCurrency(bill.amount)}</span>
                  </div>
                ))}
                <Link href="/dashboard/bills">
                  <Button size="sm" className="w-full mt-2 bg-primary hover:bg-primary/90">
                    Go to Bills
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configure Link */}
      <div className="p-3 border-t text-center" style={{ borderColor: 'var(--color-border)' }}>
        <Link
          href="/dashboard/settings"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Configure budget schedule in Settings
        </Link>
      </div>
    </div>
  );
}

