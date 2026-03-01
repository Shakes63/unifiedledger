'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { Loader2, CreditCard, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import Decimal from 'decimal.js';
import type { BillInstanceAllocation } from '@/lib/types';

interface BillInstance {
  id: string;
  billId: string;
  dueDate: string;
  expectedAmount: number;
  status: string;
  paidAmount?: number;
  remainingAmount?: number | null;
  paymentStatus?: 'unpaid' | 'partial' | 'paid' | 'overpaid';
}

interface Bill {
  id: string;
  name: string;
  accountId?: string;
  billType?: 'expense' | 'income' | 'savings_transfer';
  splitAcrossPeriods?: boolean;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currentBalance?: number;
}

interface BillPayFormProps {
  instance: BillInstance;
  bill: Bill;
  accounts: Account[];
  defaultAccountId?: string;
  onPay: (accountId: string, amount: number, allocationId?: string) => void;
  onMarkPaid: () => void;
  onCancel: () => void;
  processing: boolean;
  // New props for allocation support
  allocation?: BillInstanceAllocation | null;
  allAllocations?: BillInstanceAllocation[];
  displayAmount?: number; // The amount to display (allocated or full)
  displayRemainingAmount?: number; // Remaining for this period/allocation
}

export function BillPayForm({
  instance,
  bill,
  accounts,
  defaultAccountId,
  onPay,
  onMarkPaid,
  onCancel,
  processing,
  allocation,
  allAllocations = [],
  displayAmount,
  displayRemainingAmount,
}: BillPayFormProps) {
  const [accountId, setAccountId] = useState(defaultAccountId || '');
  const [showDetails, setShowDetails] = useState(false);
  
  // Calculate the effective amount to pay
  const effectiveRemainingAmount = displayRemainingAmount ?? 
    (instance.remainingAmount ?? instance.expectedAmount);
  
  const [amount, setAmount] = useState(effectiveRemainingAmount.toString());
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const isIncome = bill.billType === 'income';
  const isSplit = bill.splitAcrossPeriods || allAllocations.length > 1;
  const isPartiallyPaid = instance.paymentStatus === 'partial' || 
    (allocation && allocation.paidAmount > 0 && !allocation.isPaid);

  // Filter accounts based on bill type
  const availableAccounts = accounts.filter((account) => {
    if (isIncome) {
      return ['checking', 'savings', 'cash'].includes(account.type);
    }
    return true;
  });

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const paymentAmount = parseFloat(amount) || 0;

  // Validate form
  const isValid = accountId && paymentAmount > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || processing) return;
    onPay(accountId, paymentAmount, allocation?.id);
  };

  // Calculate progress percentage
  const paidSoFar = allocation ? (allocation.paidAmount || 0) : (instance.paidAmount || 0);
  const totalToPay = displayAmount ?? (allocation ? allocation.allocatedAmount : instance.expectedAmount);
  const progressPercent = totalToPay > 0 
    ? Math.min(100, (paidSoFar / totalToPay) * 100) 
    : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Payment Progress (for partial payments) */}
      {(isPartiallyPaid || progressPercent > 0) && (
        <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--color-elevated)' }}>
          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-muted-foreground)' }}>
            <span>Paid: ${new Decimal(paidSoFar).toFixed(2)}</span>
            <span>Remaining: ${new Decimal(effectiveRemainingAmount).toFixed(2)}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
            <div
              className="h-full transition-all duration-300"
              style={{ width: `${progressPercent}%`, backgroundColor: 'var(--color-success)' }}
            />
          </div>
        </div>
      )}

      {/* Split Bill Info (expandable) */}
      {isSplit && (
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-elevated)' }}>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-2 text-xs hover:bg-[color-mix(in_oklch,var(--color-background)_50%,transparent)]"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            <span>
              {allocation 
                ? `Period ${allocation.periodNumber} allocation: $${new Decimal(allocation.allocatedAmount).toFixed(2)}`
                : `Split across ${allAllocations.length} periods`}
            </span>
            {showDetails ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          
          {showDetails && (
            <div className="px-2 pb-2 space-y-1">
              <div className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                Full bill amount: ${new Decimal(instance.expectedAmount).toFixed(2)}
              </div>
              {allAllocations.length > 0 && (
                <div className="space-y-1">
                  {allAllocations.map(a => (
                    <div
                      key={a.id}
                      className="flex justify-between text-xs p-1 rounded"
                      style={
                        a.id === allocation?.id
                          ? { backgroundColor: 'color-mix(in oklch, var(--color-primary) 10%, transparent)', color: 'var(--color-foreground)' }
                          : { color: 'var(--color-muted-foreground)' }
                      }
                    >
                      <span>Period {a.periodNumber}</span>
                      <span>
                        ${new Decimal(a.paidAmount || 0).toFixed(2)} / ${new Decimal(a.allocatedAmount).toFixed(2)}
                        {a.isPaid && <Check className="w-3 h-3 ml-1 inline" style={{ color: 'var(--color-success)' }} />}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Account Selection */}
      <div>
        <Label className="text-xs mb-1 block" style={{ color: 'var(--color-muted-foreground)' }}>
          {isIncome ? 'Deposit To' : 'Pay From'}
        </Label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
            {availableAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                <div className="flex items-center gap-2">
                  <span>{account.name}</span>
                  {account.currentBalance !== undefined && (
                    <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                      (${new Decimal(account.currentBalance).toFixed(2)})
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Amount and Date Row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block" style={{ color: 'var(--color-muted-foreground)' }}>Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted-foreground)' }}>
              $
            </span>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-7"
              style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}
              placeholder={effectiveRemainingAmount.toFixed(2)}
            />
          </div>
          {paymentAmount > 0 && paymentAmount < effectiveRemainingAmount && (
            <p className="text-[10px] mt-1" style={{ color: 'var(--color-warning)' }}>
              Partial payment - ${new Decimal(effectiveRemainingAmount).minus(paymentAmount).toFixed(2)} will remain
            </p>
          )}
        </div>
        <div>
          <Label className="text-xs mb-1 block" style={{ color: 'var(--color-muted-foreground)' }}>Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}
          />
        </div>
      </div>

      {/* Balance Preview */}
      {selectedAccount && selectedAccount.currentBalance !== undefined && (
        <div className="text-xs p-2 rounded" style={{ color: 'var(--color-muted-foreground)', backgroundColor: 'var(--color-background)' }}>
          {isIncome ? (
            <>
              New balance: $
              {new Decimal(selectedAccount.currentBalance)
                .plus(new Decimal(paymentAmount || 0))
                .toFixed(2)}
            </>
          ) : (
            <>
              New balance: $
              {new Decimal(selectedAccount.currentBalance)
                .minus(new Decimal(paymentAmount || 0))
                .toFixed(2)}
            </>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          type="submit"
          disabled={!isValid || processing}
          className="flex-1 hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
        >
          {processing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <CreditCard className="w-4 h-4 mr-2" />
          )}
          {paymentAmount >= effectiveRemainingAmount 
            ? (isIncome ? 'Record & Create Transaction' : 'Pay & Create Transaction')
            : 'Make Partial Payment'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onMarkPaid}
          disabled={processing}
          style={{ border: '1px solid var(--color-border)' }}
          title="Mark as paid without creating a transaction"
        >
          <Check className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={processing}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-[10px] text-center" style={{ color: 'var(--color-muted-foreground)' }}>
        {isIncome
          ? 'This will create an income transaction and mark the bill as received.'
          : paymentAmount >= effectiveRemainingAmount
            ? 'This will create an expense transaction and mark the bill as paid.'
            : 'This will create a partial payment transaction.'}
      </p>
    </form>
  );
}
