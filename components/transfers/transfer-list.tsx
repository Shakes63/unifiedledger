'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  fromAccountName: string;
  toAccountName: string;
  amount: string | number;
  description: string;
  date: string;
  status: 'pending' | 'completed' | 'failed';
  fees?: string | number;
  notes?: string;
  createdAt: string;
}

interface TransferListProps {
  transfers?: Transfer[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function TransferList({
  transfers = [],
  isLoading = false,
  onRefresh,
}: TransferListProps) {
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (transferId: string) => {
    if (!window.confirm('Are you sure you want to delete this transfer?')) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/transfers/${transferId}`, { credentials: 'include', method: 'DELETE', });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete transfer');
      }

      toast.success('Transfer deleted successfully');
      onRefresh?.();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete transfer'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-400/10 text-emerald-400';
      case 'pending':
        return 'bg-amber-400/10 text-amber-400';
      case 'failed':
        return 'bg-red-400/10 text-red-400';
      default:
        return 'bg-gray-400/10 text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8 text-center bg-[#1a1a1a] border-[#2a2a2a]">
        <p className="text-[#9ca3af]">Loading transfers...</p>
      </Card>
    );
  }

  if (transfers.length === 0) {
    return (
      <Card className="p-8 text-center bg-[#1a1a1a] border-[#2a2a2a]">
        <p className="text-[#9ca3af]">No transfers yet</p>
        <p className="text-[#6b7280] text-sm mt-2">
          Create your first transfer to move money between accounts
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {transfers.map((transfer) => (
          <Card
            key={transfer.id}
            className="p-4 bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a] transition cursor-pointer"
            onClick={() => setSelectedTransfer(transfer)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-white font-medium">
                      {transfer.fromAccountName}
                    </span>
                    <ArrowRight className="w-4 h-4 text-[#6b7280]" />
                    <span className="text-white font-medium">
                      {transfer.toAccountName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getStatusColor(transfer.status)}>
                      {transfer.status}
                    </Badge>
                    <span className="text-[#6b7280] text-sm">
                      {formatDate(transfer.date)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-white font-medium">
                    ${parseFloat(transfer.amount.toString()).toFixed(2)}
                  </p>
                  {transfer.fees && parseFloat(transfer.fees.toString()) > 0 && (
                    <p className="text-[#6b7280] text-sm">
                      Fee: ${parseFloat(transfer.fees.toString()).toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTransfer(transfer);
                    }}
                    className="text-[#9ca3af] hover:text-white hover:bg-[#242424]"
                  >
                    <Info className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(transfer.id);
                    }}
                    disabled={isDeleting}
                    className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Transfer Details Dialog */}
      <Dialog open={!!selectedTransfer} onOpenChange={(open) => !open && setSelectedTransfer(null)}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
          <DialogHeader>
            <DialogTitle>Transfer Details</DialogTitle>
          </DialogHeader>

          {selectedTransfer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[#6b7280] text-sm mb-1">From Account</p>
                  <p className="text-white font-medium">
                    {selectedTransfer.fromAccountName}
                  </p>
                </div>
                <div>
                  <p className="text-[#6b7280] text-sm mb-1">To Account</p>
                  <p className="text-white font-medium">
                    {selectedTransfer.toAccountName}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[#6b7280] text-sm mb-1">Amount</p>
                  <p className="text-white font-medium">
                    ${parseFloat(selectedTransfer.amount.toString()).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[#6b7280] text-sm mb-1">Status</p>
                  <Badge variant="outline" className={getStatusColor(selectedTransfer.status)}>
                    {selectedTransfer.status}
                  </Badge>
                </div>
              </div>

              {selectedTransfer.fees && parseFloat(selectedTransfer.fees.toString()) > 0 && (
                <div>
                  <p className="text-[#6b7280] text-sm mb-1">Fees</p>
                  <p className="text-white font-medium">
                    ${parseFloat(selectedTransfer.fees.toString()).toFixed(2)}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[#6b7280] text-sm mb-1">Date</p>
                <p className="text-white font-medium">
                  {formatDate(selectedTransfer.date)}
                </p>
              </div>

              <div>
                <p className="text-[#6b7280] text-sm mb-1">Description</p>
                <p className="text-white">
                  {selectedTransfer.description}
                </p>
              </div>

              {selectedTransfer.notes && (
                <div>
                  <p className="text-[#6b7280] text-sm mb-1">Notes</p>
                  <p className="text-white">{selectedTransfer.notes}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => handleDelete(selectedTransfer.id)}
                  disabled={isDeleting}
                  variant="destructive"
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Transfer'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
