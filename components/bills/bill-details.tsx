'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Trash2, Edit, ArrowLeft, Calendar, DollarSign, CheckCircle2, AlertCircle, Clock, User, MoreHorizontal, ExternalLink, SkipForward } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/bills">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Bills
            </Button>
          </Link>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/bills/edit/${billId}`}>
            <Button variant="outline" size="sm" className="border-[#2a2a2a] hover:bg-[#1a1a1a]">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Bill Details Card */}
      <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl text-white">{bill.name}</CardTitle>
              <CardDescription className="text-gray-400 mt-2">
                {bill.isActive ? (
                  <span className="text-emerald-400">Active</span>
                ) : (
                  <span className="text-red-400">Inactive</span>
                )}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                ${bill.expectedAmount.toFixed(2)}
              </div>
              <div className="text-sm text-gray-400">
                {bill.isVariableAmount ? 'Variable amount' : 'Fixed amount'}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Frequency</span>
              </div>
              <p className="text-white">{FREQUENCY_LABELS[bill.frequency] || bill.frequency}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Due Date</span>
              </div>
              <p className="text-white">
                {formatDueDateDisplay(bill.frequency, bill.dueDate, bill.specificDueDate || null, bill.startMonth)}
              </p>
            </div>

            {category && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-400">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-medium">Category</span>
                </div>
                <p className="text-white">{category.name}</p>
              </div>
            )}

            {merchant && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-400">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">Merchant</span>
                </div>
                <p className="text-white">{merchant.name}</p>
              </div>
            )}

            {account && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-400">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">Account</span>
                </div>
                <p className="text-white">{account.name}</p>
              </div>
            )}

            {bill.isVariableAmount && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-400">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-medium">Amount Tolerance</span>
                </div>
                <p className="text-white">{bill.amountTolerance}%</p>
              </div>
            )}
          </div>

          {bill.payeePatterns && (
            <div className="space-y-2 pt-2 border-t border-[#2a2a2a]">
              <div className="text-sm font-medium text-gray-400">Payee Patterns</div>
              <p className="text-white">{bill.payeePatterns}</p>
            </div>
          )}

          {bill.notes && (
            <div className="space-y-2 pt-2 border-t border-[#2a2a2a]">
              <div className="text-sm font-medium text-gray-400">Notes</div>
              <p className="text-white">{bill.notes}</p>
            </div>
          )}

          <div className="pt-2 border-t border-[#2a2a2a] flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-400">Auto-mark paid: </span>
              <span className="text-white">{bill.autoMarkPaid ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-gray-400">Created: </span>
              <span className="text-white">{format(parseISO(bill.createdAt), 'MMM d, yyyy')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Instances */}
      {overdueInstances.length > 0 && (
        <Card className="bg-card border-error/30">
          <CardHeader>
            <CardTitle className="text-error flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Overdue Instances ({overdueInstances.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-warning" />
              Upcoming Instances
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              Recently Paid
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SkipForward className="w-5 h-5 text-muted-foreground" />
              Skipped Instances
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
    <div className="flex items-center justify-between p-3 bg-elevated border border-border rounded-lg hover:bg-card transition-colors">
      <div className="flex items-start gap-3 flex-1">
        <div className="mt-0.5">
          {isPaid && <CheckCircle2 className="w-5 h-5 text-success" />}
          {isOverdue && <AlertCircle className="w-5 h-5 text-error" />}
          {isPending && <Clock className="w-5 h-5 text-warning" />}
          {isSkipped && <SkipForward className="w-5 h-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">Due: {format(dueDate, 'MMM d, yyyy')}</p>
          {isOverdue && instance.daysLate > 0 && (
            <p className="text-sm text-error">
              {instance.daysLate} day{instance.daysLate !== 1 ? 's' : ''} overdue
              {instance.lateFee > 0 && ` - Late fee: $${instance.lateFee.toFixed(2)}`}
            </p>
          )}
          {isPaid && instance.paidDate && (
            <p className="text-sm text-success">
              Paid: {format(parseISO(instance.paidDate), 'MMM d, yyyy')}
            </p>
          )}
          {isSkipped && (
            <p className="text-sm text-muted-foreground">Skipped</p>
          )}
          {instance.notes && (
            <p className="text-sm text-muted-foreground mt-1 truncate">{instance.notes}</p>
          )}
          {isPaid && instance.transactionId && (
            <Link
              href={`/dashboard/transactions/${instance.transactionId}`}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
            >
              <ExternalLink className="w-3 h-3" />
              View Transaction
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="font-mono font-medium text-foreground">${instance.expectedAmount.toFixed(2)}</p>
          {instance.actualAmount && instance.actualAmount !== instance.expectedAmount && (
            <p className="text-sm text-muted-foreground font-mono">
              Actual: ${instance.actualAmount.toFixed(2)}
            </p>
          )}
        </div>
        
        {/* Action Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="w-4 h-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border">
            {(isPending || isOverdue) && (
              <>
                <DropdownMenuItem
                  onClick={() => onAction(instance)}
                  className="cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                  Mark as Paid
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onAction(instance)}
                  className="cursor-pointer"
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  Skip Instance
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onAction(instance)}
                  className="cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Link to Transaction
                </DropdownMenuItem>
              </>
            )}
            {isPaid && (
              <>
                {instance.transactionId && (
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/dashboard/transactions/${instance.transactionId}`}
                      className="cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Linked Transaction
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => onAction(instance)}
                  className="cursor-pointer"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Mark as Pending
                </DropdownMenuItem>
              </>
            )}
            {isSkipped && (
              <DropdownMenuItem
                onClick={() => onAction(instance)}
                className="cursor-pointer"
              >
                <Clock className="w-4 h-4 mr-2" />
                Mark as Pending
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
