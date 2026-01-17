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
        <div className="p-2 bg-elevated rounded-lg">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Paid: ${new Decimal(paidSoFar).toFixed(2)}</span>
            <span>Remaining: ${new Decimal(effectiveRemainingAmount).toFixed(2)}</span>
          </div>
          <div className="h-2 bg-background rounded-full overflow-hidden">
            <div 
              className="h-full bg-success transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Split Bill Info (expandable) */}
      {isSplit && (
        <div className="bg-elevated rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-2 text-xs text-muted-foreground hover:bg-background/50"
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
              <div className="text-xs text-muted-foreground">
                Full bill amount: ${new Decimal(instance.expectedAmount).toFixed(2)}
              </div>
              {allAllocations.length > 0 && (
                <div className="space-y-1">
                  {allAllocations.map(a => (
                    <div 
                      key={a.id}
                      className={`flex justify-between text-xs p-1 rounded ${
                        a.id === allocation?.id ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      <span>Period {a.periodNumber}</span>
                      <span>
                        ${new Decimal(a.paidAmount || 0).toFixed(2)} / ${new Decimal(a.allocatedAmount).toFixed(2)}
                        {a.isPaid && <Check className="w-3 h-3 ml-1 inline text-success" />}
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
        <Label className="text-xs text-muted-foreground mb-1 block">
          {isIncome ? 'Deposit To' : 'Pay From'}
        </Label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="bg-background border-border">
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {availableAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                <div className="flex items-center gap-2">
                  <span>{account.name}</span>
                  {account.currentBalance !== undefined && (
                    <span className="text-xs text-muted-foreground">
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
          <Label className="text-xs text-muted-foreground mb-1 block">Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-7 bg-background border-border"
              placeholder={effectiveRemainingAmount.toFixed(2)}
            />
          </div>
          {paymentAmount > 0 && paymentAmount < effectiveRemainingAmount && (
            <p className="text-[10px] text-warning mt-1">
              Partial payment - ${new Decimal(effectiveRemainingAmount).minus(paymentAmount).toFixed(2)} will remain
            </p>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-background border-border"
          />
        </div>
      </div>

      {/* Balance Preview */}
      {selectedAccount && selectedAccount.currentBalance !== undefined && (
        <div className="text-xs text-muted-foreground p-2 bg-background rounded">
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
          className="flex-1 bg-primary hover:bg-primary/90 text-white"
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
          className="border-border"
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

      <p className="text-[10px] text-muted-foreground text-center">
        {isIncome
          ? 'This will create an income transaction and mark the bill as received.'
          : paymentAmount >= effectiveRemainingAmount
            ? 'This will create an expense transaction and mark the bill as paid.'
            : 'This will create a partial payment transaction.'}
      </p>
    </form>
  );
}
