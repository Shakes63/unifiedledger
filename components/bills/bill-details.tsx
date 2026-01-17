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
import type { Bill } from '@/lib/types';

interface BillInstance {
  id: string;
  userId: string;
  householdId: string;
  billId: string;
  dueDate: string;
  expectedAmount: number;
  actualAmount?: number | null;
  paidDate?: string | null;
  transactionId?: string | null;
  status: 'pending' | 'paid' | 'overdue' | 'skipped';
  daysLate: number;
  lateFee: number;
  isManualOverride: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

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
      const response = await fetchWithHousehold(`/api/bills/${billId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch bill');
      }
      const data = await response.json();
      setBill(data.bill);
      setInstances(data.instances || []);
      setCategory(data.category || null);
      setMerchant(data.merchant || null);
      setAccount(data.account || null);
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
      const response = await fetchWithHousehold(`/api/bills/${billId}`, { method: 'DELETE' });

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
        <div className="text-red-400">Error: {error || 'Bill not found'}</div>
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
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-7">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back
          </Button>
        </Link>
        <div className="flex gap-1.5">
          <Link href={`/dashboard/bills/edit/${billId}`}>
            <Button variant="outline" size="sm" className="h-7 border-border hover:bg-elevated">
              <Edit className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </Button>
          </Link>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="h-7 bg-error hover:bg-error/90"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Bill Details Card */}
      <Card className="bg-card border-border gap-0 py-0">
        <CardHeader className="pt-2 pb-1 px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg text-foreground">{bill.name}</CardTitle>
              <span className={`text-xs px-2 py-0.5 rounded-full ${bill.isActive ? 'bg-income/10 text-income' : 'bg-error/10 text-error'}`}>
                {bill.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="text-right">
              <div className="text-xl font-mono font-bold text-foreground leading-tight">
                ${bill.expectedAmount.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                {bill.isVariableAmount ? 'Variable' : 'Fixed'}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-1 px-3 pb-2 space-y-1.5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1">
            <div>
              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                <Clock className="w-3 h-3" />
                Frequency
              </div>
              <p className="text-sm text-foreground">{FREQUENCY_LABELS[bill.frequency] || bill.frequency}</p>
            </div>

            <div>
              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                <Calendar className="w-3 h-3" />
                Due Date
              </div>
              <p className="text-sm text-foreground">
                {formatDueDateDisplay(bill.frequency, bill.dueDate, bill.specificDueDate || null, bill.startMonth)}
              </p>
            </div>

            {category && (
              <div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <DollarSign className="w-3 h-3" />
                  Category
                </div>
                <p className="text-sm text-foreground">{category.name}</p>
              </div>
            )}

            {merchant && (
              <div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <User className="w-3 h-3" />
                  Merchant
                </div>
                <p className="text-sm text-foreground">{merchant.name}</p>
              </div>
            )}

            {account && (
              <div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <User className="w-3 h-3" />
                  Account
                </div>
                <p className="text-sm text-foreground">{account.name}</p>
              </div>
            )}

            {bill.isVariableAmount && (
              <div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <DollarSign className="w-3 h-3" />
                  Tolerance
                </div>
                <p className="text-sm text-foreground">{bill.amountTolerance}%</p>
              </div>
            )}
          </div>

          {bill.payeePatterns && (
            <div className="pt-1 border-t border-border">
              <span className="text-xs text-muted-foreground">Payee Patterns: </span>
              <span className="text-sm text-foreground">{bill.payeePatterns}</span>
            </div>
          )}

          {bill.notes && (
            <div className="pt-1 border-t border-border">
              <span className="text-xs text-muted-foreground">Notes: </span>
              <span className="text-sm text-foreground">{bill.notes}</span>
            </div>
          )}

          <div className="pt-1 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
            <span>Auto-mark: <span className="text-foreground">{bill.autoMarkPaid ? 'Yes' : 'No'}</span></span>
            <span>Created: <span className="text-foreground">{format(parseISO(bill.createdAt), 'MMM d, yyyy')}</span></span>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Instances */}
      {overdueInstances.length > 0 && (
        <Card className="bg-card border-error/30 gap-0 py-0">
          <CardHeader className="py-1.5 px-3">
            <CardTitle className="text-error flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="w-3.5 h-3.5" />
              Overdue
              <span className="text-xs font-normal text-muted-foreground">({overdueInstances.length})</span>
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
        <Card className="bg-card border-border gap-0 py-0">
          <CardHeader className="py-1.5 px-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="w-3.5 h-3.5 text-warning" />
              Upcoming
              <span className="text-xs font-normal text-muted-foreground">({upcomingInstances.length})</span>
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
        <Card className="bg-card border-border gap-0 py-0">
          <CardHeader className="py-1.5 px-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              Paid
              <span className="text-xs font-normal text-muted-foreground">({paidInstances.length})</span>
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
        <Card className="bg-card border-border gap-0 py-0">
          <CardHeader className="py-1.5 px-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <SkipForward className="w-3.5 h-3.5 text-muted-foreground" />
              Skipped
              <span className="text-xs font-normal text-muted-foreground">({instances.filter(i => i.status === 'skipped').length})</span>
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
    <div className="flex items-center justify-between px-2 py-1.5 bg-elevated border border-border rounded-md hover:bg-card transition-colors">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isPaid && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
        {isOverdue && <AlertCircle className="w-4 h-4 text-error shrink-0" />}
        {isPending && <Clock className="w-4 h-4 text-warning shrink-0" />}
        {isSkipped && <SkipForward className="w-4 h-4 text-muted-foreground shrink-0" />}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{format(dueDate, 'MMM d, yyyy')}</span>
            {isOverdue && instance.daysLate > 0 && (
              <span className="text-error">
                {instance.daysLate}d late{instance.lateFee > 0 && ` (+$${instance.lateFee.toFixed(0)})`}
              </span>
            )}
            {isPaid && instance.paidDate && (
              <span className="text-success">Paid {format(parseISO(instance.paidDate), 'MMM d')}</span>
            )}
            {isSkipped && <span className="text-muted-foreground">Skipped</span>}
          </div>
          {instance.notes && (
            <p className="text-xs text-muted-foreground truncate">{instance.notes}</p>
          )}
          {isPaid && instance.transactionId && (
            <Link
              href={`/dashboard/transactions/${instance.transactionId}`}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              View
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 pl-2">
        <div className="text-right">
          <p className="font-mono text-sm font-medium text-foreground">${instance.expectedAmount.toFixed(2)}</p>
          {instance.actualAmount && instance.actualAmount !== instance.expectedAmount && (
            <p className="text-xs text-muted-foreground font-mono">
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
          <DropdownMenuContent align="end" className="bg-card border-border">
            {(isPending || isOverdue) && (
              <>
                <DropdownMenuItem onClick={() => onAction(instance)} className="cursor-pointer text-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-success" />
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
