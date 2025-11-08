'use client';

import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Trash2, Edit, ArrowLeft, Calendar, DollarSign, CheckCircle2, AlertCircle, Clock, User } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface BillInstance {
  id: string;
  userId: string;
  billId: string;
  dueDate: string;
  expectedAmount: number;
  actualAmount?: number;
  paidDate?: string;
  transactionId?: string;
  status: 'pending' | 'paid' | 'overdue' | 'skipped';
  daysLate: number;
  lateFee: number;
  isManualOverride: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Bill {
  id: string;
  userId: string;
  name: string;
  categoryId?: string;
  expectedAmount: number;
  dueDate: number;
  isVariableAmount: boolean;
  amountTolerance: number;
  payeePatterns?: string;
  accountId?: string;
  isActive: boolean;
  autoMarkPaid: boolean;
  notes?: string;
  createdAt: string;
}

interface Category {
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
  const [bill, setBill] = useState<Bill | null>(null);
  const [instances, setInstances] = useState<BillInstance[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchBill = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/bills/${billId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch bill');
        }
        const data = await response.json();
        setBill(data.bill);
        setInstances(data.instances || []);
        setCategory(data.category || null);
        setAccount(data.account || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchBill();
  }, [billId]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this bill? This will delete all bill instances and cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`/api/bills/${billId}`, {
        method: 'DELETE',
      });

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
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Due Date</span>
              </div>
              <p className="text-white">Day {bill.dueDate} of each month</p>
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
        <Card className="bg-[#0a0a0a] border-red-900/30">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Overdue Instances ({overdueInstances.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueInstances.map((instance) => (
              <InstanceItem key={instance.id} instance={instance} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Instances */}
      {upcomingInstances.length > 0 && (
        <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              Upcoming Instances
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingInstances.map((instance) => (
              <InstanceItem key={instance.id} instance={instance} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Paid Instances */}
      {paidInstances.length > 0 && (
        <Card className="bg-[#0a0a0a] border-[#2a2a2a]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Recently Paid
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {paidInstances.map((instance) => (
              <InstanceItem key={instance.id} instance={instance} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InstanceItem({ instance }: { instance: BillInstance }) {
  const dueDate = parseISO(instance.dueDate);

  return (
    <div className="flex items-center justify-between p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
      <div className="flex items-start gap-3 flex-1">
        <div className="mt-0.5">
          {instance.status === 'paid' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {instance.status === 'overdue' && <AlertCircle className="w-5 h-5 text-red-400" />}
          {instance.status === 'pending' && <Clock className="w-5 h-5 text-amber-400" />}
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-400">Due: {format(dueDate, 'MMM d, yyyy')}</p>
          {instance.status === 'overdue' && instance.daysLate > 0 && (
            <p className="text-sm text-red-400">
              {instance.daysLate} day{instance.daysLate !== 1 ? 's' : ''} overdue
              {instance.lateFee > 0 && ` • Late fee: $${instance.lateFee.toFixed(2)}`}
            </p>
          )}
          {instance.status === 'paid' && instance.paidDate && (
            <p className="text-sm text-emerald-400">
              Paid: {format(parseISO(instance.paidDate), 'MMM d, yyyy')}
            </p>
          )}
          {instance.notes && (
            <p className="text-sm text-gray-500 mt-1">{instance.notes}</p>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium text-white">${instance.expectedAmount.toFixed(2)}</p>
        {instance.actualAmount && instance.actualAmount !== instance.expectedAmount && (
          <p className="text-sm text-gray-400">
            Actual: ${instance.actualAmount.toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
}
