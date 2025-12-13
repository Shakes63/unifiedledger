'use client';

import { useState, useEffect } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { CalendarHeader } from '@/components/calendar/calendar-header';
import { CalendarMonth } from '@/components/calendar/calendar-month';
import { CalendarWeek } from '@/components/calendar/calendar-week';
import { CalendarDayModal } from '@/components/calendar/calendar-day-modal';
import { Loader2 } from 'lucide-react';

interface GoalSummary {
  id: string;
  name: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  status: string;
}

interface DebtSummary {
  id: string;
  name: string;
  color: string;
  remainingBalance: number;
  originalAmount: number;
  progress: number;
  type: 'target' | 'milestone';
  milestonePercentage?: number;
  status: string;
}

interface AutopayEventSummary {
  id: string;
  billId: string;
  billName: string;
  amount: number;
  autopayAmountType: 'fixed' | 'minimum_payment' | 'statement_balance' | 'full_balance';
  sourceAccountId: string;
  sourceAccountName: string;
  linkedAccountName?: string;
}

interface UnifiedPayoffDateSummary {
  id: string;
  name: string;
  source: 'account' | 'bill';
  sourceType: string;
  remainingBalance: number;
  monthlyPayment: number;
  color?: string;
}

interface BillMilestoneSummary {
  id: string;
  billId?: string;
  accountId?: string;
  name: string;
  percentage: number;
  achievedAt?: string;
  color?: string;
}

interface DayTransactionSummary {
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  totalSpent: number;
  billDueCount: number;
  billOverdueCount: number;
  bills?: Array<{ 
    name: string; 
    status: string; 
    amount: number;
    isDebt?: boolean;
    isAutopayEnabled?: boolean;
    linkedAccountName?: string;
  }>;
  goalCount: number;
  goals?: GoalSummary[];
  debtCount: number;
  debts?: DebtSummary[];
  autopayCount: number;
  autopayEvents?: AutopayEventSummary[];
  payoffDateCount: number;
  payoffDates?: UnifiedPayoffDateSummary[];
  billMilestoneCount: number;
  billMilestones?: BillMilestoneSummary[];
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  category?: string;
}

interface Bill {
  id: string;
  billId?: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  isDebt?: boolean;
  isAutopayEnabled?: boolean;
  linkedAccountName?: string;
}

interface Goal {
  id: string;
  name: string;
  description?: string | null;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  color: string;
  icon: string;
  status: string;
  category?: string | null;
}

interface Debt {
  id: string;
  name: string;
  description?: string | null;
  creditorName: string;
  remainingBalance: number;
  originalAmount: number;
  progress: number;
  color: string;
  icon: string;
  type: string;
  status: string;
  debtType: 'target' | 'milestone';
  milestonePercentage?: number;
  source?: 'legacy' | 'account' | 'bill';
}

interface AutopayEvent {
  id: string;
  billId: string;
  billInstanceId: string;
  billName: string;
  amount: number;
  autopayAmountType: string;
  sourceAccountId: string;
  sourceAccountName: string;
  linkedAccountId?: string;
  linkedAccountName?: string;
  dueDate: string;
}

interface UnifiedPayoffDate {
  id: string;
  name: string;
  source: 'account' | 'bill';
  sourceType: string;
  remainingBalance: number;
  monthlyPayment: number;
  projectedPayoffDate: string;
  color?: string;
  interestRate?: number;
}

interface BillMilestone {
  id: string;
  billId?: string;
  accountId?: string;
  name: string;
  percentage: number;
  achievedAt: string;
  color?: string;
  milestoneBalance: number;
  source: 'account' | 'bill';
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [daySummaries, setDaySummaries] = useState<
    Record<string, DayTransactionSummary>
  >({});
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedDayTransactions, setSelectedDayTransactions] = useState<
    Transaction[]
  >([]);
  const [selectedDayBills, setSelectedDayBills] = useState<Bill[]>([]);
  const [selectedDayGoals, setSelectedDayGoals] = useState<Goal[]>([]);
  const [selectedDayDebts, setSelectedDayDebts] = useState<Debt[]>([]);
  const [selectedDayAutopay, setSelectedDayAutopay] = useState<AutopayEvent[]>([]);
  const [selectedDayPayoffDates, setSelectedDayPayoffDates] = useState<UnifiedPayoffDate[]>([]);
  const [selectedDayBillMilestones, setSelectedDayBillMilestones] = useState<BillMilestone[]>([]);
  const [selectedDayInfo, setSelectedDayInfo] = useState<DayTransactionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const loadCalendarData = async () => {
      try {
        setIsLoading(true);

        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);

        // Fetch month summary
        const response = await fetch(`/api/calendar/month?startDate=${monthStart.toISOString()}&endDate=${monthEnd.toISOString()}`, { credentials: 'include' });

        if (response.ok) {
          const data = await response.json();
          setDaySummaries(data.daySummaries || {});
        }
      } catch (error) {
        console.error('Error loading calendar data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCalendarData();
  }, [currentDate]);

  const handleDayClick = async (date: Date) => {
    try {
      setIsLoading(true);
      setSelectedDay(date);

      // Fetch day details
      const response = await fetch(`/api/calendar/day?date=${date.toISOString()}`, { credentials: 'include' });

      if (response.ok) {
        const data = await response.json();
        setSelectedDayTransactions(data.transactions || []);
        setSelectedDayBills(data.bills || []);
        setSelectedDayGoals(data.goals || []);
        setSelectedDayDebts(data.debts || []);
        setSelectedDayAutopay(data.autopayEvents || []);
        setSelectedDayPayoffDates(data.payoffDates || []);
        setSelectedDayBillMilestones(data.billMilestones || []);
        setSelectedDayInfo(data.summary);
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('Error loading day details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <CalendarHeader
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-(--color-primary)" />
        </div>
      )}

      {/* Calendar View */}
      {!isLoading && (
        <>
          {viewMode === 'month' ? (
            <CalendarMonth
              currentMonth={currentDate}
              daySummaries={daySummaries}
              onDayClick={handleDayClick}
            />
          ) : (
            <CalendarWeek
              currentDate={currentDate}
              daySummaries={daySummaries}
              onDayClick={handleDayClick}
            />
          )}
        </>
      )}

      {/* Day Detail Modal */}
      {selectedDay && (
        <CalendarDayModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          date={selectedDay}
          transactions={selectedDayTransactions}
          bills={selectedDayBills}
          goals={selectedDayGoals}
          debts={selectedDayDebts}
          autopayEvents={selectedDayAutopay}
          payoffDates={selectedDayPayoffDates}
          billMilestones={selectedDayBillMilestones}
          transactionCounts={selectedDayInfo || undefined}
        />
      )}
      </div>
    </div>
  );
}
