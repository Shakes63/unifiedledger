'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  SkipForward,
  ExternalLink,
  DollarSign,
  Calendar,
  Receipt,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';
import { FREQUENCY_LABELS } from '@/lib/bills/bill-utils';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { getTodayLocalDateString } from '@/lib/utils/local-date';

interface MonthData {
  dueDate: number;
  amount: number;
  instanceId: string;
  status: 'pending' | 'paid' | 'overdue' | 'skipped';
  actualAmount?: number;
  paidDate?: string;
}

interface BillInfo {
  id: string;
  name: string;
  frequency: string;
  expectedAmount: number;
}

interface AnnualPlanningCellModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: BillInfo | null;
  month: number;
  year: number;
  data: MonthData | null;
  onUpdate?: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function AnnualPlanningCellModal({
  open,
  onOpenChange,
  bill,
  month,
  year,
  data,
  onUpdate,
}: AnnualPlanningCellModalProps) {
  const { fetchWithHousehold } = useHouseholdFetch();
  const [isUpdating, setIsUpdating] = useState(false);
  const [actualAmount, setActualAmount] = useState<string>(
    data?.actualAmount?.toString() || data?.amount?.toString() || ''
  );

  if (!bill) return null;

  const monthName = MONTH_NAMES[month - 1];
  
  // Format the due date
  const getDueDateSuffix = (day: number) => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const getStatusInfo = () => {
    switch (data?.status) {
      case 'paid':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-income" />,
          label: 'Paid',
          color: 'text-income',
          bgColor: 'bg-income/10',
        };
      case 'pending':
        return {
          icon: <Clock className="w-5 h-5 text-warning" />,
          label: 'Pending',
          color: 'text-warning',
          bgColor: 'bg-warning/10',
        };
      case 'overdue':
        return {
          icon: <AlertCircle className="w-5 h-5 text-error" />,
          label: 'Overdue',
          color: 'text-error',
          bgColor: 'bg-error/10',
        };
      case 'skipped':
        return {
          icon: <SkipForward className="w-5 h-5 text-muted-foreground" />,
          label: 'Skipped',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/30',
        };
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo();

  const handleMarkAsPaid = async () => {
    if (!data?.instanceId) return;

    setIsUpdating(true);
    try {
      const amount = parseFloat(actualAmount) || data.amount;
      
      const response = await fetchWithHousehold(`/api/bills/occurrences/${data.instanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'paid',
          actualAmountCents: Math.round(amount * 100),
          paidDate: getTodayLocalDateString(),
        }),
      });

      if (response.ok) {
        toast.success('Bill marked as paid');
        onUpdate?.();
        onOpenChange(false);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update bill');
      }
    } catch (error) {
      console.error('Error updating bill:', error);
      toast.error('Failed to update bill');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSkip = async () => {
    if (!data?.instanceId) return;

    setIsUpdating(true);
    try {
      const response = await fetchWithHousehold(`/api/bills/occurrences/${data.instanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'skipped',
        }),
      });

      if (response.ok) {
        toast.success('Bill instance skipped');
        onUpdate?.();
        onOpenChange(false);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to skip bill');
      }
    } catch (error) {
      console.error('Error skipping bill:', error);
      toast.error('Failed to skip bill');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkAsPending = async () => {
    if (!data?.instanceId) return;

    setIsUpdating(true);
    try {
      const response = await fetchWithHousehold(`/api/bills/occurrences/${data.instanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'unpaid',
          actualAmountCents: null,
          paidDate: null,
        }),
      });

      if (response.ok) {
        toast.success('Bill status reset to pending');
        onUpdate?.();
        onOpenChange(false);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update bill');
      }
    } catch (error) {
      console.error('Error updating bill:', error);
      toast.error('Failed to update bill');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            {bill.name}
            {statusInfo && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${statusInfo.bgColor} ${statusInfo.color}`}>
                {statusInfo.icon}
                {statusInfo.label}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {monthName} {year} - {FREQUENCY_LABELS[bill.frequency] || bill.frequency}
          </DialogDescription>
        </DialogHeader>

        {data ? (
          <div className="space-y-4">
            {/* Bill Details */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-elevated rounded-lg">
              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="text-sm font-medium text-foreground">
                    {monthName} {data.dueDate}{getDueDateSuffix(data.dueDate)}, {year}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Expected Amount</p>
                  <p className="text-sm font-medium text-foreground font-mono">
                    ${data.amount.toFixed(2)}
                  </p>
                </div>
              </div>
              {data.status === 'paid' && data.actualAmount && (
                <div className="flex items-start gap-3">
                  <Receipt className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Actual Amount Paid</p>
                    <p className="text-sm font-medium text-income font-mono">
                      ${data.actualAmount.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
              {data.status === 'paid' && data.paidDate && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Paid Date</p>
                    <p className="text-sm font-medium text-foreground">
                      {format(parseISO(data.paidDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Mark as Paid Section - Only show if not already paid */}
            {data.status !== 'paid' && (
              <div className="p-4 border border-border rounded-lg space-y-3">
                <Label htmlFor="actualAmount" className="text-muted-foreground text-sm">
                  Payment Amount
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="actualAmount"
                      type="number"
                      step="0.01"
                      value={actualAmount}
                      onChange={(e) => setActualAmount(e.target.value)}
                      placeholder={data.amount.toString()}
                      className="pl-7 bg-elevated border-border text-foreground font-mono"
                    />
                  </div>
                  <Button
                    onClick={handleMarkAsPaid}
                    disabled={isUpdating}
                    className="bg-income hover:bg-income/90 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {isUpdating ? 'Saving...' : 'Mark Paid'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-muted-foreground">
            <p>No bill instance for this month.</p>
            <p className="text-sm mt-2">
              This bill is not scheduled for {monthName} {year}.
            </p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {data && (
            <>
              {data.status === 'paid' || data.status === 'skipped' ? (
                <Button
                  variant="outline"
                  onClick={handleMarkAsPending}
                  disabled={isUpdating}
                  className="bg-elevated border-border text-foreground hover:bg-elevated"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Reset to Pending
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  disabled={isUpdating}
                  className="bg-elevated border-border text-foreground hover:bg-elevated"
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  Skip This Month
                </Button>
              )}
            </>
          )}
          
          <Link href={`/dashboard/bills/${bill.id}`} className="w-full sm:w-auto">
            <Button 
              variant="outline" 
              className="w-full bg-elevated border-border text-foreground hover:bg-elevated"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Bill Details
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
