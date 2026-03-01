'use client';

import { useState } from 'react';
import { ArrowRight, Trash2, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { useHouseholdFetch } from '@/lib/hooks/use-household-fetch';

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

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  completed: { color: 'var(--color-income)',  label: 'Completed' },
  pending:   { color: 'var(--color-warning)', label: 'Pending'   },
  failed:    { color: 'var(--color-error)',   label: 'Failed'    },
};

export function TransferList({ transfers = [], isLoading = false, onRefresh }: TransferListProps) {
  const { deleteWithHousehold } = useHouseholdFetch();
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (transferId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('Delete this transfer? This cannot be undone.')) return;

    try {
      setIsDeleting(true);
      const response = await deleteWithHousehold(`/api/transfers/${transferId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete transfer');
      }
      toast.success('Transfer deleted');
      setSelectedTransfer(null);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete transfer');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
      >
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="px-5 py-4 animate-pulse flex items-center gap-4"
            style={{
              borderBottom: i < 2 ? '1px solid color-mix(in oklch, var(--color-border) 40%, transparent)' : 'none',
              animationDelay: `${i * 80}ms`,
            }}
          >
            <div className="w-16 h-3 rounded" style={{ backgroundColor: 'var(--color-elevated)' }} />
            <div className="flex-1 h-3 rounded" style={{ backgroundColor: 'var(--color-elevated)' }} />
            <div className="w-20 h-3 rounded" style={{ backgroundColor: 'var(--color-elevated)' }} />
          </div>
        ))}
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div
        className="rounded-xl py-16 text-center"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
      >
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
          style={{ backgroundColor: 'color-mix(in oklch, var(--color-primary) 12%, transparent)' }}
        >
          <ArrowLeftRight className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
        </div>
        <p className="font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>No transfers yet</p>
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          Create a transfer to move money between accounts
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Connected list container */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
      >
        {/* Column headers */}
        <div
          className="grid px-5 py-2"
          style={{
            gridTemplateColumns: '90px 1fr 110px',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'color-mix(in oklch, var(--color-elevated) 40%, transparent)',
          }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>Date</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-muted-foreground)' }}>Flow</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-right" style={{ color: 'var(--color-muted-foreground)' }}>Amount</span>
        </div>

        {transfers.map((transfer, idx) => {
          const amount = parseFloat(transfer.amount.toString());
          const fees = transfer.fees ? parseFloat(transfer.fees.toString()) : 0;
          const statusStyle = STATUS_STYLES[transfer.status] ?? STATUS_STYLES.completed;

          return (
            <div
              key={transfer.id}
              className="group relative tx-row-enter"
              style={{
                animationDelay: `${idx * 35}ms`,
                borderBottom: idx < transfers.length - 1
                  ? '1px solid color-mix(in oklch, var(--color-border) 35%, transparent)'
                  : 'none',
              }}
            >
              <button
                onClick={() => setSelectedTransfer(transfer)}
                className="w-full text-left px-5 py-3.5 transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-elevated) 40%, transparent)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  className="grid items-center gap-3"
                  style={{ gridTemplateColumns: '90px 1fr 110px' }}
                >
                  {/* Date */}
                  <div>
                    <p className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
                      {formatDate(transfer.date)}
                    </p>
                    {/* Status dot + label */}
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: statusStyle.color }}
                      />
                      <span className="text-[10px]" style={{ color: statusStyle.color }}>
                        {statusStyle.label}
                      </span>
                    </div>
                  </div>

                  {/* Flow: From → To */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-sm font-medium truncate max-w-[120px]"
                      style={{ color: 'var(--color-foreground)' }}
                    >
                      {transfer.fromAccountName}
                    </span>
                    {/* Connecting line with arrow */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className="w-6 h-px"
                        style={{ backgroundColor: 'var(--color-border)' }}
                      />
                      <ArrowRight
                        className="w-3 h-3 shrink-0"
                        style={{ color: 'var(--color-muted-foreground)' }}
                      />
                      <span
                        className="w-6 h-px"
                        style={{ backgroundColor: 'var(--color-border)' }}
                      />
                    </div>
                    <span
                      className="text-sm font-medium truncate max-w-[120px]"
                      style={{ color: 'var(--color-foreground)' }}
                    >
                      {transfer.toAccountName}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p
                      className="text-sm font-mono font-semibold tabular-nums"
                      style={{ color: 'var(--color-foreground)' }}
                    >
                      ${fmt(amount)}
                    </p>
                    {fees > 0 && (
                      <p className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--color-muted-foreground)' }}>
                        +${fmt(fees)} fee
                      </p>
                    )}
                  </div>
                </div>

                {/* Description, shown when not default */}
                {transfer.description && transfer.description !== 'Transfer' && (
                  <p
                    className="text-[11px] mt-1 pl-[calc(90px+12px)] truncate"
                    style={{ color: 'var(--color-muted-foreground)' }}
                  >
                    {transfer.description}
                  </p>
                )}
              </button>

              {/* Delete button — hover-revealed */}
              <button
                onClick={(e) => handleDelete(transfer.id, e)}
                disabled={isDeleting}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md"
                style={{ color: 'var(--color-error)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-error) 10%, transparent)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                title="Delete transfer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Transfer Detail Dialog */}
      <Dialog open={!!selectedTransfer} onOpenChange={(open) => !open && setSelectedTransfer(null)}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden"
          style={{
            maxWidth: '420px',
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            borderRadius: '14px',
          }}
        >
          {selectedTransfer && (() => {
            const amount = parseFloat(selectedTransfer.amount.toString());
            const fees = selectedTransfer.fees ? parseFloat(selectedTransfer.fees.toString()) : 0;
            const statusStyle = STATUS_STYLES[selectedTransfer.status] ?? STATUS_STYLES.completed;

            return (
              <>
                {/* Header */}
                <div
                  className="px-5 pt-5 pb-4"
                  style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}
                >
                  <DialogTitle className="sr-only">Transfer Details</DialogTitle>
                  {/* Flow diagram */}
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="px-2.5 py-1.5 rounded-lg text-sm font-medium"
                      style={{
                        backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)',
                        color: 'var(--color-foreground)',
                      }}
                    >
                      {selectedTransfer.fromAccountName}
                    </div>
                    <div className="flex items-center gap-1 flex-1">
                      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border)' }} />
                    </div>
                    <div
                      className="px-2.5 py-1.5 rounded-lg text-sm font-medium"
                      style={{
                        backgroundColor: 'color-mix(in oklch, var(--color-income) 10%, transparent)',
                        color: 'var(--color-foreground)',
                      }}
                    >
                      {selectedTransfer.toAccountName}
                    </div>
                  </div>
                  {/* Big amount */}
                  <div
                    className="text-3xl font-bold font-mono tabular-nums"
                    style={{ color: 'var(--color-foreground)', letterSpacing: '-0.02em' }}
                  >
                    ${fmt(amount)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusStyle.color }} />
                    <span className="text-xs font-medium" style={{ color: statusStyle.color }}>{statusStyle.label}</span>
                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>· {formatDate(selectedTransfer.date)}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="px-5 py-4 space-y-3">
                  {fees > 0 && (
                    <Row label="Fees" value={`$${fmt(fees)}`} />
                  )}
                  <Row label="Description" value={selectedTransfer.description} />
                  {selectedTransfer.notes && (
                    <Row label="Notes" value={selectedTransfer.notes} />
                  )}
                  <Row label="Transfer ID" value={selectedTransfer.id.slice(0, 12) + '…'} mono />
                </div>

                {/* Delete */}
                <div className="px-5 pb-5">
                  <button
                    onClick={() => handleDelete(selectedTransfer.id)}
                    disabled={isDeleting}
                    className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: 'color-mix(in oklch, var(--color-error) 10%, transparent)',
                      color: 'var(--color-error)',
                      border: '1px solid color-mix(in oklch, var(--color-error) 25%, transparent)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-error) 18%, transparent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'color-mix(in oklch, var(--color-error) 10%, transparent)')}
                  >
                    <Trash2 className="w-4 h-4" />
                    {isDeleting ? 'Deleting…' : 'Delete Transfer'}
                  </button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[11px] uppercase tracking-widest font-semibold shrink-0" style={{ color: 'var(--color-muted-foreground)' }}>
        {label}
      </span>
      <span
        className={`text-sm text-right ${mono ? 'font-mono tabular-nums' : ''}`}
        style={{ color: 'var(--color-foreground)' }}
      >
        {value}
      </span>
    </div>
  );
}
