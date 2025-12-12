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
import { Loader2, CreditCard, Check, X } from 'lucide-react';
import Decimal from 'decimal.js';

interface BillInstance {
  id: string;
  billId: string;
  dueDate: string;
  expectedAmount: number;
  status: string;
}

interface Bill {
  id: string;
  name: string;
  accountId?: string;
  billType?: 'expense' | 'income' | 'savings_transfer';
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
  onPay: (accountId: string, amount: number) => void;
  onMarkPaid: () => void;
  onCancel: () => void;
  processing: boolean;
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
}: BillPayFormProps) {
  const [accountId, setAccountId] = useState(defaultAccountId || '');
  const [amount, setAmount] = useState(instance.expectedAmount.toString());
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const isIncome = bill.billType === 'income';

  // Filter accounts based on bill type
  const availableAccounts = accounts.filter((account) => {
    // For income, show checking/savings accounts
    // For expenses, show all accounts
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
    onPay(accountId, paymentAmount);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
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
              placeholder={instance.expectedAmount.toFixed(2)}
            />
          </div>
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
          className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white"
        >
          {processing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <CreditCard className="w-4 h-4 mr-2" />
          )}
          {isIncome ? 'Record & Create Transaction' : 'Pay & Create Transaction'}
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
          : 'This will create an expense transaction and mark the bill as paid.'}
      </p>
    </form>
  );
}




