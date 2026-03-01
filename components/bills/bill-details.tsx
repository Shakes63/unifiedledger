'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Trash2, Edit, ArrowLeft, Calendar, DollarSign, CheckCircle2, AlertCircle, Clock, User, MoreHorizontal, ExternalLink, SkipForward } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useHousehold } from '@/contexts/household-context';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';
import { BillInstanceActionsModal } from './bill-instance-actions-modal';
import {
  FREQUENCY_LABELS,
  formatDueDateDisplay,
} from '@/lib/bills/bill-utils';
import type { Bill, BillInstance } from '@/lib/types';
import type {
  BillOccurrenceDto,
  BillTemplateDto,
  OccurrenceStatus,
  RecurrenceType,
} from '@/lib/bills/contracts';

interface Category {
  id: string;
  name: string;
}

interface Merchant {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
}

interface BillDetailsProps {
  billId: string;
  onDelete?: () => void;
}

function centsToDollars(value: number | null | undefined): number {
  return (value || 0) / 100;
}

function recurrenceToFrequency(recurrenceType: RecurrenceType): Bill['frequency'] {
  if (recurrenceType === 'one_time') return 'one-time';
  if (recurrenceType === 'semi_annual') return 'semi-annual';
  return recurrenceType;
}

function mapOccurrenceStatus(status: OccurrenceStatus): BillInstance['status'] {
  if (status === 'paid' || status === 'overpaid') return 'paid';
  if (status === 'overdue') return 'overdue';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

function getLegacyDueDate(template: BillTemplateDto): number {
  if (template.recurrenceType === 'weekly' || template.recurrenceType === 'biweekly') {
    return template.recurrenceDueWeekday ?? 0;
  }
  if (template.recurrenceType === 'one_time') {
    const day = Number(template.recurrenceSpecificDueDate?.split('-')[2] || '1');
    return Number.isFinite(day) && day > 0 ? day : 1;
  }
  return template.recurrenceDueDay ?? 1;
}

function mapTemplateToBill(template: BillTemplateDto): Bill {
  return {
    id: template.id,
    userId: template.createdByUserId,
    householdId: template.householdId,
    name: template.name,
    categoryId: template.categoryId,
    merchantId: template.merchantId,
    debtId: null,
    expectedAmount: centsToDollars(template.defaultAmountCents),
    dueDate: getLegacyDueDate(template),
    frequency: recurrenceToFrequency(template.recurrenceType),
    specificDueDate: template.recurrenceSpecificDueDate,
    startMonth: template.recurrenceStartMonth,
    isVariableAmount: template.isVariableAmount,
    amountTolerance: (template.amountToleranceBps || 0) / 100,
    payeePatterns: null,
    accountId: template.paymentAccountId,
    isActive: template.isActive,
    autoMarkPaid: template.autoMarkPaid,
    notes: template.notes,
    budgetPeriodAssignment: template.budgetPeriodAssignment,
    splitAcrossPeriods: template.splitAcrossPeriods,
    splitAllocations: null,
    createdAt: template.createdAt,
  };
}

function mapOccurrenceToBillInstance(occurrence: BillOccurrenceDto): BillInstance {
  return {
    id: occurrence.id,
    userId: '',
    householdId: occurrence.householdId,
    billId: occurrence.templateId,
    dueDate: occurrence.dueDate,
    expectedAmount: centsToDollars(occurrence.amountDueCents),
    actualAmount:
      occurrence.actualAmountCents !== null ? centsToDollars(occurrence.actualAmountCents) : null,
    paidDate: occurrence.paidDate,
    transactionId: occurrence.lastTransactionId,
    status: mapOccurrenceStatus(occurrence.status),
    daysLate: occurrence.daysLate,
    lateFee: centsToDollars(occurrence.lateFeeCents),
    isManualOverride: occurrence.isManualOverride,
    notes: occurrence.notes,
    budgetPeriodOverride: occurrence.budgetPeriodOverride,
    paidAmount: centsToDollars(occurrence.amountPaidCents),
    remainingAmount: centsToDollars(occurrence.amountRemainingCents),
    createdAt: occurrence.createdAt,
    updatedAt: occurrence.updatedAt,
  };
}

export function BillDetails({ billId, onDelete }: BillDetailsProps) {
  const router = useRouter();
  const { selectedHouseholdId } = useHousehold();
  const { fetchWithHousehold } = useHouseholdFetch();
  const [bill, setBill] = useState<Bill | null>(null);
  const [instances, setInstances] = useState<BillInstance[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Modal state for instance actions
  const [selectedInstance, setSelectedInstance] = useState<BillInstance | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchBillData = useCallback(async () => {
    if (!selectedHouseholdId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetchWithHousehold(`/api/bills/templates/${billId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch bill');
      }
      const payload = await response.json() as {
        data?: {
          template: BillTemplateDto;
          occurrences: BillOccurrenceDto[];
          category: Category | null;
          merchant: Merchant | null;
          account: Account | null;
        };
      };
      if (!payload.data?.template) {
        throw new Error('Bill template not found');
      }
      setBill(mapTemplateToBill(payload.data.template));
      setInstances((payload.data.occurrences || []).map(mapOccurrenceToBillInstance));
      setCategory(payload.data.category || null);
      setMerchant(payload.data.merchant || null);
      setAccount(payload.data.account || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [billId, selectedHouseholdId, fetchWithHousehold]);

  useEffect(() => {
    fetchBillData();
  }, [fetchBillData]);

  const handleOpenInstanceModal = (instance: BillInstance) => {
    setSelectedInstance(instance);
    setIsModalOpen(true);
  };

  const handleInstanceUpdated = () => {
    // Refetch bill data to get updated instances
    fetchBillData();
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this bill? This will delete all bill instances and cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetchWithHousehold(`/api/bills/templates/${billId}`, { method: 'DELETE' });

      if (!response.ok) {
        throw new Error('Failed to delete bill');
      }

      toast.success('Bill deleted successfully');

      if (onDelete) {
        onDelete();
      } else {
        router.push('/dashboard/bills');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to delete bill: ${message}`);
      console.error('Delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-400">Loading bill details...</div>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="flex items-center justify-center py-8">
        <div style={{ color: 'var(--color-destructive)' }}>Error: {error || 'Bill not found'}</div>
      </div>
    );
  }

  const upcomingInstances = instances.filter(i => i.status === 'pending').slice(0, 5);
  const overdueInstances = instances.filter(i => i.status === 'overdue');
  const paidInstances = instances.filter(i => i.status === 'paid').slice(0, 5);

  return (
    <div className="space-y-2">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/bills">
          <Button variant="ghost" size="sm" className="h-7 hover:opacity-100"
            style={{ color: 'var(--color-muted-foreground)' }}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back
          </Button>
        </Link>
        <div className="flex gap-1.5">
          <Link href={`/dashboard/bills/edit/${billId}`}>
            <Button variant="outline" size="sm" className="h-7 border hover:bg-[var(--color-elevated)]"
            style={{ borderColor: 'var(--color-border)' }}>
              <Edit className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </Button>
          </Link>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="h-7 hover:opacity-90"
            style={{ backgroundColor: 'var(--color-destructive)' }}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Bill Details Card */}
      <Card className="gap-0 py-0 border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        <CardHeader className="pt-2 pb-1 px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg" style={{ color: 'var(--color-foreground)' }}>{bill.name}</CardTitle>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: bill.isActive ? 'color-mix(in oklch, var(--color-income) 10%, transparent)' : 'color-mix(in oklch, var(--color-destructive) 10%, transparent)',
                  color: bill.isActive ? 'var(--color-income)' : 'var(--color-destructive)',
                }}
              >
                {bill.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="text-right">
              <div className="text-xl font-mono font-bold leading-tight" style={{ color: 'var(--color-foreground)' }}>
                ${bill.expectedAmount.toFixed(2)}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                {bill.isVariableAmount ? 'Variable' : 'Fixed'}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-1 px-3 pb-2 space-y-1.5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1">
            <div>
              <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                <Clock className="w-3 h-3" />
                Frequency
              </div>
              <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>{FREQUENCY_LABELS[bill.frequency] || bill.frequency}</p>
            </div>

            <div>
              <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                <Calendar className="w-3 h-3" />
                Due Date
              </div>
              <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>
                {formatDueDateDisplay(bill.frequency, bill.dueDate, bill.specificDueDate || null, bill.startMonth)}
              </p>
            </div>

            {category && (
              <div>
                <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  <DollarSign className="w-3 h-3" />
                  Category
                </div>
                <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>{category.name}</p>
              </div>
            )}

            {merchant && (
              <div>
                <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  <User className="w-3 h-3" />
                  Merchant
                </div>
                <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>{merchant.name}</p>
              </div>
            )}

            {account && (
              <div>
                <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  <User className="w-3 h-3" />
                  Account
                </div>
                <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>{account.name}</p>
              </div>
            )}

            {bill.isVariableAmount && (
              <div>
                <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  <DollarSign className="w-3 h-3" />
                  Tolerance
                </div>
                <p className="text-sm" style={{ color: 'var(--color-foreground)' }}>{bill.amountTolerance}%</p>
              </div>
            )}
          </div>

          {bill.payeePatterns && (
            <div className="pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Payee Patterns: </span>
              <span className="text-sm" style={{ color: 'var(--color-foreground)' }}>{bill.payeePatterns}</span>
            </div>
          )}

          {bill.notes && (
            <div className="pt-1 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>Notes: </span>
              <span className="text-sm" style={{ color: 'var(--color-foreground)' }}>{bill.notes}</span>
            </div>
          )}

          <div className="pt-1 border-t flex items-center gap-4 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
            <span>Auto-mark: <span style={{ color: 'var(--color-foreground)' }}>{bill.autoMarkPaid ? 'Yes' : 'No'}</span></span>
            <span>Created: <span style={{ color: 'var(--color-foreground)' }}>{format(parseISO(bill.createdAt), 'MMM d, yyyy')}</span></span>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Instances */}
      {overdueInstances.length > 0 && (
        <Card
        className="gap-0 py-0 border"
        style={{ backgroundColor: 'var(--color-background)', borderColor: 'color-mix(in oklch, var(--color-destructive) 30%, transparent)' }}
      >
          <CardHeader className="py-1.5 px-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-destructive)' }}>
              <AlertCircle className="w-3.5 h-3.5" />
              Overdue
              <span className="text-xs font-normal" style={{ color: 'var(--color-muted-foreground)' }}>({overdueInstances.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-1.5 space-y-0.5">
            {overdueInstances.map((instance) => (
              <InstanceItem
                key={instance.id}
                instance={instance}
                bill={bill}
                onAction={handleOpenInstanceModal}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Instances */}
      {upcomingInstances.length > 0 && (
        <Card className="gap-0 py-0 border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
          <CardHeader className="py-1.5 px-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="w-3.5 h-3.5" style={{ color: 'var(--color-warning)' }} />
              Upcoming
              <span className="text-xs font-normal" style={{ color: 'var(--color-muted-foreground)' }}>({upcomingInstances.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-1.5 space-y-0.5">
            {upcomingInstances.map((instance) => (
              <InstanceItem
                key={instance.id}
                instance={instance}
                bill={bill}
                onAction={handleOpenInstanceModal}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Paid Instances */}
      {paidInstances.length > 0 && (
        <Card className="gap-0 py-0 border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
          <CardHeader className="py-1.5 px-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} />
              Paid
              <span className="text-xs font-normal" style={{ color: 'var(--color-muted-foreground)' }}>({paidInstances.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-1.5 space-y-0.5">
            {paidInstances.map((instance) => (
              <InstanceItem
                key={instance.id}
                instance={instance}
                bill={bill}
                onAction={handleOpenInstanceModal}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Skipped Instances */}
      {instances.filter(i => i.status === 'skipped').length > 0 && (
        <Card className="gap-0 py-0 border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
          <CardHeader className="py-1.5 px-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <SkipForward className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />
              Skipped
              <span className="text-xs font-normal" style={{ color: 'var(--color-muted-foreground)' }}>({instances.filter(i => i.status === 'skipped').length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 pb-1.5 space-y-0.5">
            {instances.filter(i => i.status === 'skipped').map((instance) => (
              <InstanceItem
                key={instance.id}
                instance={instance}
                bill={bill}
                onAction={handleOpenInstanceModal}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Instance Actions Modal */}
      {selectedInstance && bill && (
        <BillInstanceActionsModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          instance={selectedInstance}
          bill={bill}
          onSuccess={handleInstanceUpdated}
        />
      )}
    </div>
  );
}

interface InstanceItemProps {
  instance: BillInstance;
  bill: Bill;
  onAction: (instance: BillInstance) => void;
}

function InstanceItem({ instance, bill: _bill, onAction }: InstanceItemProps) {
  const dueDate = parseISO(instance.dueDate);
  const isPending = instance.status === 'pending';
  const isOverdue = instance.status === 'overdue';
  const isPaid = instance.status === 'paid';
  const isSkipped = instance.status === 'skipped';

  return (
    <div
    className="flex items-center justify-between px-2 py-1.5 border rounded-md hover:bg-[var(--color-card)] transition-colors"
    style={{ backgroundColor: 'var(--color-elevated)', borderColor: 'var(--color-border)' }}
  >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isPaid && <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--color-success)' }} />}
        {isOverdue && <AlertCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--color-destructive)' }} />}
        {isPending && <Clock className="w-4 h-4 shrink-0" style={{ color: 'var(--color-warning)' }} />}
        {isSkipped && <SkipForward className="w-4 h-4 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: 'var(--color-muted-foreground)' }}>{format(dueDate, 'MMM d, yyyy')}</span>
            {isOverdue && instance.daysLate > 0 && (
              <span style={{ color: 'var(--color-destructive)' }}>
                {instance.daysLate}d late{instance.lateFee > 0 && ` (+$${instance.lateFee.toFixed(0)})`}
              </span>
            )}
            {isPaid && instance.paidDate && (
              <span style={{ color: 'var(--color-success)' }}>Paid {format(parseISO(instance.paidDate), 'MMM d')}</span>
            )}
            {isSkipped && <span style={{ color: 'var(--color-muted-foreground)' }}>Skipped</span>}
          </div>
          {instance.notes && (
            <p className="text-xs truncate" style={{ color: 'var(--color-muted-foreground)' }}>{instance.notes}</p>
          )}
          {isPaid && instance.transactionId && (
            <Link
              href={`/dashboard/transactions/${instance.transactionId}`}
              className="text-xs hover:underline inline-flex items-center gap-1"
            style={{ color: 'var(--color-primary)' }}
            >
              <ExternalLink className="w-3 h-3" />
              View
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 pl-2">
        <div className="text-right">
          <p className="font-mono text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>${instance.expectedAmount.toFixed(2)}</p>
          {instance.actualAmount && instance.actualAmount !== instance.expectedAmount && (
            <p className="text-xs font-mono" style={{ color: 'var(--color-muted-foreground)' }}>
              ${instance.actualAmount.toFixed(2)}
            </p>
          )}
        </div>
        
        {/* Action Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="w-3.5 h-3.5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
            {(isPending || isOverdue) && (
              <>
                <DropdownMenuItem onClick={() => onAction(instance)} className="cursor-pointer text-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" style={{ color: 'var(--color-success)' }} />
                  Mark Paid
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction(instance)} className="cursor-pointer text-sm">
                  <SkipForward className="w-3.5 h-3.5 mr-2" />
                  Skip
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onAction(instance)} className="cursor-pointer text-sm">
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  Link Transaction
                </DropdownMenuItem>
              </>
            )}
            {isPaid && (
              <>
                {instance.transactionId && (
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/transactions/${instance.transactionId}`} className="cursor-pointer text-sm">
                      <ExternalLink className="w-3.5 h-3.5 mr-2" />
                      View Transaction
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onAction(instance)} className="cursor-pointer text-sm">
                  <Clock className="w-3.5 h-3.5 mr-2" />
                  Mark Pending
                </DropdownMenuItem>
              </>
            )}
            {isSkipped && (
              <DropdownMenuItem onClick={() => onAction(instance)} className="cursor-pointer text-sm">
                <Clock className="w-3.5 h-3.5 mr-2" />
                Mark Pending
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
