'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';

interface QuickTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TransactionType = 'income' | 'expense' | 'transfer_in' | 'transfer_out';

export function QuickTransactionModal({
  open,
  onOpenChange,
}: QuickTransactionModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts on mount
  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
        if (data.length > 0 && !accountId) {
          setAccountId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      fetchAccounts();
    } else {
      // Reset form
      setAmount('');
      setDescription('');
      setType('expense');
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!amount || !description || !accountId) {
        setError('Please fill in all required fields');
        return;
      }

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          amount: parseFloat(amount),
          description,
          type,
          date: new Date().toISOString().split('T')[0],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create transaction');
      }

      // Success - reset and close
      setAmount('');
      setDescription('');
      setType('expense');
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Quick Transaction</DialogTitle>
          <DialogDescription>
            Add a transaction in seconds. Leave category blank for now.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Type</label>
            <Select value={type} onValueChange={(value) => setType(value as TransactionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="transfer_out">Transfer Out</SelectItem>
                <SelectItem value="transfer_in">Transfer In</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Account */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Account</label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
                autoFocus
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Description *</label>
            <Input
              placeholder="e.g., Coffee, Gas, Salary"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creating...' : 'Add'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              size="icon"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
