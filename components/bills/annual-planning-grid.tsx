'use client';

import { useMemo } from 'react';
import { FREQUENCY_LABELS } from '@/lib/bills/bill-utils';
import { AnnualPlanningCell } from './annual-planning-cell';
import Decimal from 'decimal.js';

interface MonthData {
  dueDate: number;
  amount: number;
  instanceId: string;
  status: 'pending' | 'paid' | 'overdue' | 'skipped';
  actualAmount?: number;
  paidDate?: string;
}

interface BillWithMonthlyData {
  id: string;
  name: string;
  frequency: string;
  expectedAmount: number;
  isActive: boolean;
  notes?: string;
  monthlyData: Record<string, MonthData | null>;
}

interface AnnualPlanningGridProps {
  bills: BillWithMonthlyData[];
  monthNames: string[];
  year: number;
  onCellClick?: (billId: string, month: number, data: MonthData | null) => void;
}

const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function AnnualPlanningGrid({
  bills,
  monthNames: _monthNames,
  year,
  onCellClick,
}: AnnualPlanningGridProps) {
  // Calculate monthly totals
  const monthlyTotals = useMemo(() => {
    const totals: Record<string, { total: Decimal; paidCount: number; pendingCount: number; overdueCount: number }> = {};
    
    for (let i = 1; i <= 12; i++) {
      totals[String(i)] = { total: new Decimal(0), paidCount: 0, pendingCount: 0, overdueCount: 0 };
    }

    for (const bill of bills) {
      for (let month = 1; month <= 12; month++) {
        const data = bill.monthlyData[String(month)];
        if (data) {
          totals[String(month)].total = totals[String(month)].total.plus(new Decimal(data.amount));
          if (data.status === 'paid') totals[String(month)].paidCount++;
          else if (data.status === 'pending') totals[String(month)].pendingCount++;
          else if (data.status === 'overdue') totals[String(month)].overdueCount++;
        }
      }
    }

    return totals;
  }, [bills]);

  // Calculate annual total
  const annualTotal = useMemo(() => {
    let total = new Decimal(0);
    for (const key in monthlyTotals) {
      total = total.plus(monthlyTotals[key].total);
    }
    return total;
  }, [monthlyTotals]);

  if (bills.length === 0) {
    return (
      <div className="border rounded-xl p-8 text-center" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        <p className="mb-4" style={{ color: 'var(--color-muted-foreground)' }}>No non-monthly bills found for {year}.</p>
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          Add quarterly, semi-annual, annual, or one-time bills to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
      {/* Responsive container with horizontal scroll */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          {/* Header Row */}
          <thead>
            <tr className="border-b" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
              {/* Bill Name Column Header */}
              <th className="sticky left-0 z-10 px-4 py-3 text-left text-sm font-semibold w-[200px] min-w-[200px] border-r" style={{ backgroundColor: 'var(--color-elevated)', color: 'var(--color-foreground)', borderColor: 'var(--color-border)' }}>
                Bill
              </th>
              {/* Month Headers */}
              {SHORT_MONTH_NAMES.map((month, _index) => (
                <th
                  key={month}
                  className="px-2 py-3 text-center text-sm font-semibold min-w-[70px]"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  {month}
                </th>
              ))}
              {/* Annual Total Header */}
              <th className="px-3 py-3 text-center text-sm font-semibold min-w-[90px] border-l" style={{ color: 'var(--color-foreground)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {/* Bill Rows */}
            {bills.map((bill, billIndex) => {
              const billTotal = Object.values(bill.monthlyData).reduce((sum, data) => {
                if (data) return sum.plus(new Decimal(data.amount));
                return sum;
              }, new Decimal(0));

              return (
                <tr
                  key={bill.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: billIndex % 2 === 0 ? 'var(--color-background)' : 'color-mix(in oklch, var(--color-elevated) 25%, var(--color-background))' }}
                >
                  {/* Bill Name Cell */}
                  <td className="sticky left-0 z-10 px-4 py-3 border-r" style={{ backgroundColor: billIndex % 2 === 0 ? 'var(--color-background)' : 'color-mix(in oklch, var(--color-elevated) 25%, var(--color-background))', borderColor: 'var(--color-border)' }}>
                    <div className="flex flex-col">
                      <span className="font-medium truncate max-w-[180px]" style={{ color: 'var(--color-foreground)' }} title={bill.name}>
                        {bill.name}
                      </span>
<span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                      {FREQUENCY_LABELS[bill.frequency] || bill.frequency}
                    </span>
                    </div>
                  </td>

                  {/* Month Cells */}
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                    const data = bill.monthlyData[String(month)];
                    return (
                      <td key={month} className="px-1 py-2">
                        <AnnualPlanningCell
                          data={data}
                          onClick={() => onCellClick?.(bill.id, month, data)}
                        />
                      </td>
                    );
                  })}

                  {/* Bill Annual Total */}
                  <td className="px-3 py-3 text-center border-l" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-elevated)' }}>
                    <span className="font-mono text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                      ${billTotal.toFixed(2)}
                    </span>
                  </td>
                </tr>
              );
            })}

            {/* Monthly Totals Row */}
            <tr className="border-t-2" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
              <td className="sticky left-0 z-10 px-4 py-3 border-r" style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}>
                <span className="font-semibold" style={{ color: 'var(--color-foreground)' }}>Monthly Totals</span>
              </td>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const totals = monthlyTotals[String(month)];
                const hasAmount = !totals.total.isZero();
                
                return (
                  <td key={month} className="px-2 py-3 text-center">
                    {hasAmount ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-mono text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
                          ${totals.total.toFixed(0)}
                        </span>
                        {(totals.paidCount > 0 || totals.pendingCount > 0 || totals.overdueCount > 0) && (
                          <div className="flex gap-1">
                            {totals.paidCount > 0 && (
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-income)' }} title={`${totals.paidCount} paid`} />
                            )}
                            {totals.pendingCount > 0 && (
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-warning)' }} title={`${totals.pendingCount} pending`} />
                            )}
                            {totals.overdueCount > 0 && (
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-destructive)' }} title={`${totals.overdueCount} overdue`} />
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>-</span>
                    )}
                  </td>
                );
              })}
              {/* Annual Total */}
              <td className="px-3 py-3 text-center border-l" style={{ borderColor: 'var(--color-border)' }}>
                <span className="font-mono text-base font-bold" style={{ color: 'var(--color-primary)' }}>
                  ${annualTotal.toFixed(2)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

