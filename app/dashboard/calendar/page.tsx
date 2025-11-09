'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { CalendarHeader } from '@/components/calendar/calendar-header';
import { CalendarMonth } from '@/components/calendar/calendar-month';
import { CalendarWeek } from '@/components/calendar/calendar-week';
import { CalendarDayModal } from '@/components/calendar/calendar-day-modal';
import { Loader2 } from 'lucide-react';

interface DayTransactionSummary {
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  totalSpent: number;
  billDueCount: number;
  billOverdueCount: number;
  bills?: Array<{ name: string; status: string; amount: number }>;
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
  description: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
}

export default function CalendarPage() {
  const { isLoaded } = useAuth();
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
  const [selectedDayInfo, setSelectedDayInfo] = useState<DayTransactionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    const loadCalendarData = async () => {
      try {
        setIsLoading(true);

        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);

        // Fetch month summary
        const response = await fetch(
          `/api/calendar/month?startDate=${monthStart.toISOString()}&endDate=${monthEnd.toISOString()}`
        );

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
  }, [isLoaded, currentDate]);

  const handleDayClick = async (date: Date) => {
    try {
      setIsLoading(true);
      setSelectedDay(date);

      // Fetch day details
      const response = await fetch(
        `/api/calendar/day?date=${date.toISOString()}`
      );

      if (response.ok) {
        const data = await response.json();
        setSelectedDayTransactions(data.transactions || []);
        setSelectedDayBills(data.bills || []);
        setSelectedDayInfo(data.summary);
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('Error loading day details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

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
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
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
          transactionCounts={selectedDayInfo || undefined}
        />
      )}
      </div>
    </div>
  );
}
