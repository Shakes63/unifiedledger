'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Link from 'next/link';
import { AnnualPlanningGrid } from '@/components/bills/annual-planning-grid';
import { AnnualPlanningSummary } from '@/components/bills/annual-planning-summary';
import { AnnualPlanningCellModal } from '@/components/bills/annual-planning-cell-modal';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { useHousehold } from '@/contexts/household-context';
import type { BillOccurrenceWithTemplateDto, BillTemplateDto } from '@/lib/bills/contracts';

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

interface MonthlySummary {
  total: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
}

interface NextDue {
  billId: string;
  billName: string;
  dueDate: string;
  amount: number;
  instanceId: string;
}

interface Summary {
  totalAnnualAmount: number;
  monthlyBreakdown: Record<string, MonthlySummary>;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  totalInstances: number;
  nextDue: NextDue | null;
}

interface AnnualPlanningData {
  year: number;
  bills: BillWithMonthlyData[];
  monthNames: string[];
  summary: Summary;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const NON_MONTHLY_RECURRENCES = new Set(['quarterly', 'semi_annual', 'annual', 'one_time']);

function toFrequency(recurrenceType: BillTemplateDto['recurrenceType']): string {
  if (recurrenceType === 'one_time') return 'one-time';
  if (recurrenceType === 'semi_annual') return 'semi-annual';
  return recurrenceType;
}

function toStatus(status: BillOccurrenceWithTemplateDto['occurrence']['status']): 'pending' | 'paid' | 'overdue' | 'skipped' {
  if (status === 'paid' || status === 'overpaid') return 'paid';
  if (status === 'overdue') return 'overdue';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

export default function AnnualBillPlanningPage() {
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<AnnualPlanningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<BillWithMonthlyData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [selectedCellData, setSelectedCellData] = useState<MonthData | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First, ensure bill instances exist for the requested year
      // This handles the case where instances weren't created yet
      // (e.g., viewing a future year, or server was down)
      await fetchWithHousehold('/api/bills/ensure-instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      });

      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const [templatesResponse, occurrencesResponse] = await Promise.all([
        fetchWithHousehold('/api/bills/templates?isActive=true&limit=5000'),
        fetchWithHousehold(`/api/bills/occurrences?from=${yearStart}&to=${yearEnd}&limit=10000`),
      ]);

      if (!templatesResponse.ok || !occurrencesResponse.ok) {
        throw new Error('Failed to fetch annual planning data');
      }

      const templatesResult = await templatesResponse.json();
      const occurrencesResult = await occurrencesResponse.json();

      const templates = (Array.isArray(templatesResult?.data) ? templatesResult.data : []) as BillTemplateDto[];
      const nonMonthlyTemplates = templates.filter(
        (template) => template.isActive && NON_MONTHLY_RECURRENCES.has(template.recurrenceType)
      );
      const templateIdSet = new Set(nonMonthlyTemplates.map((template) => template.id));

      const rows = (Array.isArray(occurrencesResult?.data) ? occurrencesResult.data : []) as BillOccurrenceWithTemplateDto[];
      const yearOccurrences = rows
        .filter((row) => templateIdSet.has(row.template.id))
        .map((row) => row.occurrence);

      const instancesByTemplateId = new Map<string, typeof yearOccurrences>();
      yearOccurrences.forEach((occurrence) => {
        const list = instancesByTemplateId.get(occurrence.templateId) || [];
        list.push(occurrence);
        instancesByTemplateId.set(occurrence.templateId, list);
      });

      const bills: BillWithMonthlyData[] = nonMonthlyTemplates.map((template) => {
        const monthlyData: Record<string, MonthData | null> = Object.fromEntries(
          Array.from({ length: 12 }, (_, i) => [String(i + 1), null])
        );

        const occurrences = instancesByTemplateId.get(template.id) || [];
        occurrences.forEach((occurrence) => {
          const [, monthStr, dayStr] = occurrence.dueDate.split('-');
          const month = Number(monthStr);
          const day = Number(dayStr);

          monthlyData[String(month)] = {
            dueDate: day,
            amount: occurrence.amountDueCents / 100,
            instanceId: occurrence.id,
            status: toStatus(occurrence.status),
            actualAmount: occurrence.actualAmountCents !== null ? occurrence.actualAmountCents / 100 : undefined,
            paidDate: occurrence.paidDate || undefined,
          };
        });

        return {
          id: template.id,
          name: template.name,
          frequency: toFrequency(template.recurrenceType),
          expectedAmount: template.defaultAmountCents / 100,
          isActive: template.isActive,
          notes: template.notes || undefined,
          monthlyData,
        };
      });

      const monthlyBreakdown: Record<string, MonthlySummary> = Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [
          String(i + 1),
          { total: 0, paidCount: 0, pendingCount: 0, overdueCount: 0 },
        ])
      );

      let totalAnnualAmount = 0;
      let paidCount = 0;
      let pendingCount = 0;
      let overdueCount = 0;

      yearOccurrences.forEach((occurrence) => {
        const [, monthStr] = occurrence.dueDate.split('-');
        const monthKey = String(Number(monthStr));
        const amount = occurrence.amountDueCents / 100;
        monthlyBreakdown[monthKey].total += amount;
        totalAnnualAmount += amount;

        const status = toStatus(occurrence.status);
        if (status === 'paid') {
          monthlyBreakdown[monthKey].paidCount += 1;
          paidCount += 1;
        } else if (status === 'overdue') {
          monthlyBreakdown[monthKey].overdueCount += 1;
          overdueCount += 1;
        } else if (status === 'pending') {
          monthlyBreakdown[monthKey].pendingCount += 1;
          pendingCount += 1;
        }
      });

      const today = new Date().toISOString().split('T')[0];
      const upcoming = [...yearOccurrences]
        .filter((occurrence) => toStatus(occurrence.status) === 'pending' && occurrence.dueDate >= today)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      const nextDue = upcoming.length
        ? {
            billId: upcoming[0].templateId,
            billName: nonMonthlyTemplates.find((template) => template.id === upcoming[0].templateId)?.name || 'Unknown',
            dueDate: upcoming[0].dueDate,
            amount: upcoming[0].amountDueCents / 100,
            instanceId: upcoming[0].id,
          }
        : null;

      const result: AnnualPlanningData = {
        year,
        bills,
        monthNames: MONTH_NAMES,
        summary: {
          totalAnnualAmount,
          monthlyBreakdown,
          paidCount,
          pendingCount,
          overdueCount,
          totalInstances: yearOccurrences.length,
          nextDue,
        },
      };

      setData(result);
    } catch (err) {
      console.error('Error fetching annual planning data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      toast.error('Failed to load annual planning data');
    } finally {
      setLoading(false);
    }
  }, [year, selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePrevYear = () => {
    setYear((prev) => prev - 1);
  };

  const handleNextYear = () => {
    setYear((prev) => prev + 1);
  };

  const handleCurrentYear = () => {
    setYear(new Date().getFullYear());
  };

  const handleCellClick = (billId: string, month: number, cellData: MonthData | null) => {
    const bill = data?.bills.find((b) => b.id === billId);
    if (bill) {
      setSelectedBill(bill);
      setSelectedMonth(month);
      setSelectedCellData(cellData);
      setModalOpen(true);
    }
  };

  const handleModalUpdate = () => {
    fetchData(); // Refresh the grid after updates
  };

  const handleExportCSV = () => {
    if (!data || data.bills.length === 0) {
      toast.error('No data to export');
      return;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Build CSV header
    let csv = `Bill Name,Frequency,${months.join(',')},Annual Total\n`;

    // Build rows
    for (const bill of data.bills) {
      const row = [
        `"${bill.name}"`,
        bill.frequency,
        ...months.map((_, i) => {
          const cellData = bill.monthlyData[String(i + 1)];
          if (cellData) {
            return `$${cellData.amount.toFixed(2)} (${cellData.status})`;
          }
          return '-';
        }),
        `$${Object.values(bill.monthlyData).reduce((sum, d) => sum + (d?.amount || 0), 0).toFixed(2)}`,
      ];
      csv += row.join(',') + '\n';
    }

    // Add totals row
    const totals = months.map((_, i) => {
      const total = data.bills.reduce((sum, bill) => {
        return sum + (bill.monthlyData[String(i + 1)]?.amount || 0);
      }, 0);
      return total > 0 ? `$${total.toFixed(2)}` : '-';
    });
    csv += `Totals,-,${totals.join(',')},${data.summary.totalAnnualAmount.toFixed(2)}\n`;

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `annual-bill-planning-${year}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    toast.success('Exported to CSV');
  };

  const currentYear = new Date().getFullYear();
  const isCurrentYear = year === currentYear;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/bills">
                <Button variant="ghost" size="sm" className="hover:[color:var(--color-foreground)] hover:[background-color:var(--color-elevated)]" style={{ color: 'var(--color-muted-foreground)' }}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Bills
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold mt-2" style={{ color: 'var(--color-foreground)' }}>Annual Bill Planning</h1>
            <p className="mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
              Plan and track your quarterly, semi-annual, and annual bills
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Year Navigation */}
            <div className="flex items-center gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevYear}
                className="hover:[color:var(--color-foreground)] hover:[background-color:var(--color-elevated)]"
                style={{ color: 'var(--color-muted-foreground)' }}
                aria-label="Previous year"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <button
                onClick={handleCurrentYear}
                className="px-4 py-1.5 rounded-md text-sm font-semibold transition-colors hover:[background-color:var(--color-elevated)]"
                style={
                  isCurrentYear
                    ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }
                    : { color: 'var(--color-foreground)' }
                }
              >
                {year}
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextYear}
                className="hover:[color:var(--color-foreground)] hover:[background-color:var(--color-elevated)]"
                style={{ color: 'var(--color-muted-foreground)' }}
                aria-label="Next year"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Export Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={loading || !data || data.bills.length === 0}
              className="hover:[background-color:var(--color-elevated)]"
              style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>

            {/* Add Bill Button */}
            <Link href="/dashboard/bills/new">
              <Button className="hover:opacity-90" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)' }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Bill
              </Button>
            </Link>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--color-background)' }} />
              ))}
            </div>
            <div className="h-96 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--color-background)' }} />
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="rounded-xl p-6 text-center" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 30%, transparent)' }}>
            <p className="mb-4" style={{ color: 'var(--color-destructive)' }}>{error}</p>
            <Button
              onClick={fetchData}
              className="hover:opacity-90"
              style={{ backgroundColor: 'var(--color-destructive)', color: 'white' }}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* No Household Selected */}
        {!loading && !selectedHouseholdId && (
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
            <Calendar className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--color-muted-foreground)' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>No Household Selected</h3>
            <p style={{ color: 'var(--color-muted-foreground)' }}>
              Please select a household from the sidebar to view your annual bill planning.
            </p>
          </div>
        )}

        {/* Data Loaded */}
        {!loading && !error && data && (
          <>
            {/* Summary Cards */}
            <AnnualPlanningSummary summary={data.summary} year={year} />

            {/* Planning Grid */}
            <AnnualPlanningGrid
              bills={data.bills}
              monthNames={data.monthNames}
              year={year}
              onCellClick={handleCellClick}
            />

            {/* Helpful Info */}
            {data.bills.length > 0 && (
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>Legend</h3>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: 'color-mix(in oklch, var(--color-income) 20%, transparent)', border: '1px solid color-mix(in oklch, var(--color-income) 30%, transparent)' }} />
                    <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Paid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: 'color-mix(in oklch, var(--color-warning) 20%, transparent)', border: '1px solid color-mix(in oklch, var(--color-warning) 30%, transparent)' }} />
                    <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Pending</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: 'color-mix(in oklch, var(--color-destructive) 20%, transparent)', border: '1px solid color-mix(in oklch, var(--color-destructive) 30%, transparent)' }} />
                    <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Overdue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: 'color-mix(in oklch, var(--color-muted) 30%, transparent)', border: '1px solid color-mix(in oklch, var(--color-muted-foreground) 20%, transparent)' }} />
                    <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>Skipped</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Cell Detail Modal */}
        <AnnualPlanningCellModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          bill={selectedBill ? {
            id: selectedBill.id,
            name: selectedBill.name,
            frequency: selectedBill.frequency,
            expectedAmount: selectedBill.expectedAmount,
          } : null}
          month={selectedMonth}
          year={year}
          data={selectedCellData}
          onUpdate={handleModalUpdate}
        />
      </div>
    </div>
  );
}

